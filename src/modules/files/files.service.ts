import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, isNull, lt } from 'drizzle-orm';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import { type Database, InjectDatabase, schema } from '../../database';
import type { FilePurpose, StoredFile } from '../../database/schema';
import { PUBLIC_PREFIX, StorageService } from '../../storage';
import type { CreateUploadDto } from './dto/files.dto';
import { ALLOWED_TYPES, DEFAULT_VISIBILITY, maxBytesFor } from './file-rules';

export interface UploadTicket {
  file: StoredFile;
  uploadUrl: string;
  expiresInSeconds: number;
}

@Injectable()
export class FilesService {
  constructor(
    @InjectDatabase() private readonly db: Database,
    private readonly storage: StorageService,
  ) {}

  async createUpload(
    businessId: string | null,
    dto: CreateUploadDto,
    actorUserId: string | null,
  ): Promise<UploadTicket> {
    const allowed = ALLOWED_TYPES[dto.purpose];

    if (!allowed.includes(dto.contentType)) {
      throw new BadRequestException({
        message: 'i18n:errors.file.unsupportedType',
        contentType: dto.contentType,
        purpose: dto.purpose,
      });
    }

    const limit = maxBytesFor(dto.contentType);

    if (dto.sizeBytes > limit) {
      throw new BadRequestException({
        message: 'i18n:errors.file.tooLarge',
        limit,
        actual: dto.sizeBytes,
      });
    }

    const visibility = dto.visibility ?? DEFAULT_VISIBILITY[dto.purpose];

    const id = randomUUID();
    const extension = dto.originalName.includes('.')
      ? `.${dto.originalName.split('.').pop()?.slice(0, 8)}`
      : '';

    const scope = `${businessId ?? 'platform'}/${dto.purpose}/${id}${extension}`;
    const storageKey =
      visibility === 'public' ? `${PUBLIC_PREFIX}${scope}` : scope;

    const [file] = await this.db
      .insert(schema.storedFiles)
      .values({
        id,
        businessId,
        purpose: dto.purpose,
        visibility,
        storageKey,
        originalName: dto.originalName,
        contentType: dto.contentType,
        sizeBytes: dto.sizeBytes,
        status: 'pending',
        uploadedByUserId: actorUserId,
      })
      .returning();

    return {
      file,
      uploadUrl: await this.storage.presignUpload(storageKey, dto.contentType),
      expiresInSeconds: 300,
    };
  }

  async complete(
    businessId: string | null,
    fileId: string,
  ): Promise<StoredFile> {
    const file = await this.getById(businessId, fileId);
    const stored = await this.storage.head(file.storageKey);

    if (!stored) {
      throw new BadRequestException({
        message: 'i18n:errors.file.notUploaded',
        fileId,
      });
    }

    if (stored.sizeBytes > maxBytesFor(stored.contentType)) {
      await this.storage.remove(file.storageKey);
      await this.db
        .delete(schema.storedFiles)
        .where(eq(schema.storedFiles.id, fileId));

      throw new BadRequestException({
        message: 'i18n:errors.file.tooLarge',
        limit: maxBytesFor(stored.contentType),
        actual: stored.sizeBytes,
      });
    }

    const [updated] = await this.db
      .update(schema.storedFiles)
      .set({
        status: 'ready',
        sizeBytes: stored.sizeBytes,
        contentType: stored.contentType,
        readyAt: new Date(),
      })
      .where(eq(schema.storedFiles.id, fileId))
      .returning();

    return updated;
  }

  async getById(
    businessId: string | null,
    fileId: string,
  ): Promise<StoredFile> {
    const [file] = await this.db
      .select()
      .from(schema.storedFiles)
      .where(
        and(
          eq(schema.storedFiles.id, fileId),
          businessId === null
            ? isNull(schema.storedFiles.businessId)
            : eq(schema.storedFiles.businessId, businessId),
        ),
      )
      .limit(1);

    if (!file) {
      throw new NotFoundException({
        message: 'i18n:errors.file.notFound',
        fileId,
      });
    }

    return file;
  }

  async getByIdUnscoped(fileId: string): Promise<StoredFile | undefined> {
    const [file] = await this.db
      .select()
      .from(schema.storedFiles)
      .where(eq(schema.storedFiles.id, fileId))
      .limit(1);

    return file;
  }

  async presignedUrlFor(file: StoredFile): Promise<string> {
    return this.storage.presignDownload(file.storageKey);
  }

  /**
   * A public file returns its permanent address; a private one a short-lived
   * signed URL. `expiresInSeconds` is null for the former, which is how a
   * caller knows the URL is safe to persist in a CMS block or a theme.
   */
  async downloadUrl(
    businessId: string | null,
    fileId: string,
  ): Promise<{ url: string; expiresInSeconds: number | null }> {
    const file = await this.getById(businessId, fileId);

    if (file.status !== 'ready') {
      throw new BadRequestException({
        message: 'i18n:errors.file.notUploaded',
        fileId,
      });
    }

    if (this.storage.isPublicKey(file.storageKey)) {
      return {
        url: this.storage.publicUrl(file.storageKey),
        expiresInSeconds: null,
      };
    }

    return {
      url: await this.storage.presignDownload(
        file.storageKey,
        file.originalName,
      ),
      expiresInSeconds: 600,
    };
  }

  async list(
    businessId: string | null,
    limit: number,
    offset: number,
    purpose?: FilePurpose,
  ): Promise<PaginatedResult<StoredFile>> {
    const where = and(
      businessId === null
        ? isNull(schema.storedFiles.businessId)
        : eq(schema.storedFiles.businessId, businessId),
      eq(schema.storedFiles.status, 'ready'),
      ...(purpose ? [eq(schema.storedFiles.purpose, purpose)] : []),
    );

    const [rows, [total]] = await Promise.all([
      this.db
        .select()
        .from(schema.storedFiles)
        .where(where)
        .orderBy(desc(schema.storedFiles.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ value: count() }).from(schema.storedFiles).where(where),
    ]);

    return { data: rows, total: total?.value ?? 0, limit, offset };
  }

  async remove(businessId: string | null, fileId: string): Promise<void> {
    const file = await this.getById(businessId, fileId);

    await this.storage.remove(file.storageKey);
    await this.db
      .delete(schema.storedFiles)
      .where(eq(schema.storedFiles.id, fileId));
  }

  async pruneAbandoned(olderThan: Date): Promise<number> {
    const abandoned = await this.db
      .delete(schema.storedFiles)
      .where(
        and(
          eq(schema.storedFiles.status, 'pending'),
          lt(schema.storedFiles.createdAt, olderThan),
        ),
      )
      .returning({ storageKey: schema.storedFiles.storageKey });

    for (const row of abandoned) {
      await this.storage.remove(row.storageKey).catch(() => undefined);
    }

    return abandoned.length;
  }
}
