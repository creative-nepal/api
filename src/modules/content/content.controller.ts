import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { AppConfigService } from '../../config';
import {
  type ContentLocale,
  DEFAULT_CONTENT_LOCALE,
} from '../../database/schema';
import {
  type PublicContentPage,
  type PublicNavigation,
  ContentService,
  HOME_SLUG,
} from './content.service';
import { PublicContentQueryDto } from './dto/content-request.dto';

const PREVIEW_HEADER = 'x-preview-secret';

@Controller({ path: 'content', version: '1' })
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly config: AppConfigService,
  ) {}

  @Get('pages')
  @AllowAnonymous()
  async listPages(): Promise<Array<{ slug: string; updatedAt: Date }>> {
    return this.contentService.listPublicPages();
  }

  @Get('navigation')
  @AllowAnonymous()
  async navigation(
    @Query() query: PublicContentQueryDto,
  ): Promise<PublicNavigation> {
    return this.contentService.getPublicNavigation(this.resolveLocale(query));
  }

  @Get('pages/:slug')
  @AllowAnonymous()
  async page(
    @Param('slug') slug: string,
    @Query() query: PublicContentQueryDto,
    @Headers(PREVIEW_HEADER) previewSecret?: string,
  ): Promise<PublicContentPage> {
    return this.contentService.getPublicPage(
      slug || HOME_SLUG,
      this.resolveLocale(query),
      this.isPreview(previewSecret),
    );
  }

  private resolveLocale(query: PublicContentQueryDto): ContentLocale {
    return query.locale ?? DEFAULT_CONTENT_LOCALE;
  }

  private isPreview(secret: string | undefined): boolean {
    const expected = this.config.contentPreviewSecret;
    return Boolean(expected && secret && secret === expected);
  }
}
