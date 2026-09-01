import { Injectable, Logger } from '@nestjs/common';
import { AppConfigService } from '../../config';

@Injectable()
export class ContentRevalidationService {
  private readonly logger = new Logger(ContentRevalidationService.name);

  constructor(private readonly config: AppConfigService) {}

  async revalidate(): Promise<void> {
    const url = this.config.webRevalidateUrl;
    const secret = this.config.webRevalidateSecret;

    if (!url || !secret) {
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-revalidate-secret': secret,
        },
        body: JSON.stringify({ tag: 'content' }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Content revalidation returned ${response.status} from ${url}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Content revalidation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
