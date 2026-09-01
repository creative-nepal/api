import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { I18nService } from 'nestjs-i18n';
import {
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from './i18n.constants';

@Controller({ path: 'i18n', version: '1' })
export class I18nController {
  constructor(private readonly i18n: I18nService) {}

  @Get('languages')
  @AllowAnonymous()
  languages(): Array<{ code: SupportedLanguage; label: string }> {
    return SUPPORTED_LANGUAGES.map((code) => ({
      code,
      label: this.i18n.t('common.language', { lang: code }),
    }));
  }

  @Get(':lang')
  @AllowAnonymous()
  catalogue(@Param('lang') lang: string): Record<string, unknown> {
    if (!isSupportedLanguage(lang)) {
      throw new NotFoundException(
        `Unsupported language "${lang}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}`,
      );
    }

    return {
      lang,
      common: this.i18n.t('common', { lang }),
      errors: this.i18n.t('errors', { lang }),
      ui: this.i18n.t('ui', { lang }),
    };
  }
}
