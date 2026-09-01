import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Put,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { UserHasPermission } from '@thallesp/nestjs-better-auth';
import { CurrentUser, type CurrentUserType } from '../../auth';
import type { PaginatedResult } from '../../common/dto/pagination-query.dto';
import {
  CONTENT_LOCALES,
  type ContentLocale,
  type ContentNavigation,
} from '../../database/schema';
import { type PublicNavigation, ContentService } from './content.service';
import {
  CreateContentPageDto,
  ListContentPagesQueryDto,
  UpdateContentPageDto,
  UpdateNavigationDto,
  UpsertPageTranslationDto,
} from './dto/content-request.dto';
import {
  ContentPageDto,
  ContentPageTranslationDto,
} from './dto/content-response.dto';

const LocaleParam = () =>
  new ParseEnumPipe(
    Object.fromEntries(CONTENT_LOCALES.map((locale) => [locale, locale])),
  );

@Controller({ path: 'admin/content', version: '1' })
@UseInterceptors(ClassSerializerInterceptor)
export class ContentAdminController {
  constructor(private readonly contentService: ContentService) {}

  @Get('pages')
  @UserHasPermission({ permissions: { content: ['update'] } })
  async list(
    @Query() query: ListContentPagesQueryDto,
  ): Promise<PaginatedResult<ContentPageDto>> {
    const result = await this.contentService.list(query);

    return {
      ...result,
      data: result.data.map((page) => new ContentPageDto(page)),
    };
  }

  @Get('pages/:id')
  @UserHasPermission({ permissions: { content: ['update'] } })
  async getById(@Param('id') id: string): Promise<ContentPageDto> {
    return new ContentPageDto(await this.contentService.getById(id));
  }

  @Post('pages')
  @UserHasPermission({ permissions: { content: ['create'] } })
  async create(
    @Body() dto: CreateContentPageDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ContentPageDto> {
    return new ContentPageDto(
      await this.contentService.create(dto, currentUser.id),
    );
  }

  @Patch('pages/:id')
  @UserHasPermission({ permissions: { content: ['update'] } })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateContentPageDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ContentPageDto> {
    return new ContentPageDto(
      await this.contentService.update(id, dto, currentUser.id),
    );
  }

  @Put('pages/:id/translations/:locale')
  @UserHasPermission({ permissions: { content: ['update'] } })
  async saveTranslation(
    @Param('id') id: string,
    @Param('locale', LocaleParam()) locale: ContentLocale,
    @Body() dto: UpsertPageTranslationDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ContentPageTranslationDto> {
    return new ContentPageTranslationDto(
      await this.contentService.saveTranslation(
        id,
        locale,
        dto,
        currentUser.id,
      ),
    );
  }

  @Post('pages/:id/publish')
  @UserHasPermission({ permissions: { content: ['publish'] } })
  async publish(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ContentPageDto> {
    return new ContentPageDto(
      await this.contentService.publish(id, currentUser.id),
    );
  }

  @Post('pages/:id/unpublish')
  @UserHasPermission({ permissions: { content: ['publish'] } })
  async unpublish(
    @Param('id') id: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ContentPageDto> {
    return new ContentPageDto(
      await this.contentService.unpublish(id, currentUser.id),
    );
  }

  @Delete('pages/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UserHasPermission({ permissions: { content: ['delete'] } })
  async remove(@Param('id') id: string): Promise<void> {
    await this.contentService.remove(id);
  }

  @Get('navigation/:locale')
  @UserHasPermission({ permissions: { content: ['update'] } })
  async getNavigation(
    @Param('locale', LocaleParam()) locale: ContentLocale,
  ): Promise<PublicNavigation> {
    return this.contentService.getNavigation(locale);
  }

  @Put('navigation/:locale')
  @UserHasPermission({ permissions: { content: ['update'] } })
  async saveNavigation(
    @Param('locale', LocaleParam()) locale: ContentLocale,
    @Body() dto: UpdateNavigationDto,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<ContentNavigation> {
    return this.contentService.saveNavigation(locale, dto, currentUser.id);
  }
}
