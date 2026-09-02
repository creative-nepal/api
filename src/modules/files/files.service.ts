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
import { StorageService } from '../../storage';
import { type CreateUploadDto, MAX_UPLOAD_BYTES } from './dto/files.dto';

const ALLOWED_TYPES: Record<FilePurpose, string[]> = {
  prescription: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'business-logo': ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
  'product-image': ['image/jpeg', 'image/png', 'image/webp'],
  'content-image': ['image/jpeg', 'image/png', 'image/webp'],
  attachment: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'text/csv',
  ],
};

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

    const id = randomUUID();
    const extension = dto.originalName.includes('.')
      ? `.${dto.originalName.split('.').pop()?.slice(0, 8)}`
      : '';

    const storageKey = `${businessId ?? 'platform'}/${dto.purpose}/${id}${extension}`;

    const [file] = await this.db
      .insert(schema.storedFiles)
      .values({
        id,
        businessId,
        purpose: dto.purpose,
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

    if (stored.sizeBytes > MAX_UPLOAD_BYTES) {
      await this.storage.remove(file.storageKey);
      await this.db
        .delete(schema.storedFiles)
        .where(eq(schema.storedFiles.id, fileId));

      throw new BadRequestException({
        message: 'i18n:errors.file.tooLarge',
        limit: MAX_UPLOAD_BYTES,
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

  async downloadUrl(
    businessId: string | null,
    fileId: string,
  ): Promise<{ url: string; expiresInSeconds: number }> {
    const file = await this.getById(businessId, fileId);

    if (file.status !== 'ready') {
      throw new BadRequestException({
        message: 'i18n:errors.file.notUploaded',
        fileId,
      });
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
