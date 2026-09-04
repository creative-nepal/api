import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Module } from '@nestjs/common';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule as NestI18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import {
  FALLBACK_LANGUAGE,
  LANGUAGE_HEADER,
  LANGUAGE_QUERY,
} from './i18n.constants';
import { I18nController } from './i18n.controller';

const isDevelopment = (process.env.NODE_ENV ?? 'development') === 'development';

const sourceCatalogues = join(process.cwd(), 'src', 'i18n', '/');
const compiledCatalogues = join(__dirname, '/');

const cataloguePath =
  isDevelopment && existsSync(sourceCatalogues)
    ? sourceCatalogues
    : compiledCatalogues;

@Module({
  imports: [
    NestI18nModule.forRoot({
      fallbackLanguage: FALLBACK_LANGUAGE,
      loaderOptions: {
        path: cataloguePath,
        watch: cataloguePath === sourceCatalogues,
      },
      typesOutputPath: undefined,
      resolvers: [
        { use: QueryResolver, options: [LANGUAGE_QUERY] },
        new HeaderResolver([LANGUAGE_HEADER]),
        AcceptLanguageResolver,
      ],
    }),
  ],
  controllers: [I18nController],
})
export class I18nModule {}
