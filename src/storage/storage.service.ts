import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  Injectable,
  type OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AppConfigService } from '../config';

const UPLOAD_TTL_SECONDS = 5 * 60;
const DOWNLOAD_TTL_SECONDS = 10 * 60;

export interface StoredObject {
  contentType: string;
  sizeBytes: number;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly client: S3Client | null;
  private readonly bucket: string;

  constructor(
    private readonly logger: PinoLogger,
    private readonly config: AppConfigService,
  ) {
    this.logger.setContext(StorageService.name);

    const { endpoint, region, bucket, accessKey, secretKey } =
      this.config.storage;

    this.bucket = bucket;

    this.client =
      accessKey && secretKey
        ? new S3Client({
            endpoint,
            region,
            forcePathStyle: true,
            credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
          })
        : null;
  }

  get isConfigured(): boolean {
    return this.client !== null;
  }

  async onModuleInit(): Promise<void> {
    if (!this.client) {
      this.logger.warn(
        'RUSTFS_ACCESS_KEY/RUSTFS_SECRET_KEY are not set — file uploads are disabled',
      );
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return;
    } catch {
      // Absent, or the store is unreachable — the create below tells us which.
    }

    try {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.info(
        { bucket: this.bucket },
        'Created object storage bucket',
      );
    } catch (cause) {
      // Selling must not stop because object storage is down. Uploads fail
      // loudly at the point of use; everything else keeps working.
      this.logger.error(
        { err: cause, bucket: this.bucket },
        'Object storage is unreachable — uploads will fail until it recovers',
      );
    }
  }

  private require(): S3Client {
    if (!this.client) {
      throw new ServiceUnavailableException('i18n:errors.file.storageDisabled');
    }

    return this.client;
  }

  async presignUpload(key: string, contentType: string): Promise<string> {
    return getSignedUrl(
      this.require(),
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      }),
      { expiresIn: UPLOAD_TTL_SECONDS },
    );
  }

  async presignDownload(key: string, filename?: string): Promise<string> {
    return getSignedUrl(
      this.require(),
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ...(filename
          ? {
              ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
            }
          : {}),
      }),
      { expiresIn: DOWNLOAD_TTL_SECONDS },
    );
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const result = await this.require().send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );

      return {
        contentType: result.ContentType ?? 'application/octet-stream',
        sizeBytes: result.ContentLength ?? 0,
      };
    } catch {
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    await this.require().send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
