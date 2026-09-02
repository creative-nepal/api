import { BadRequestException } from '@nestjs/common';
import type { BusinessTheme } from '../../database/schema';

const COLOUR =
  /^(#[0-9a-fA-F]{3,8}|(?:oklch|rgb|rgba|hsl|hsla)\([0-9.%,\s/-]+\)|[a-z]{3,20})$/;
const LENGTH = /^[0-9]+(\.[0-9]+)?(px|rem|em)$/;
const MODES = new Set(['light', 'dark', 'system']);

const COLOUR_KEYS = ['primary', 'primaryForeground', 'accent'] as const;

function assertString(key: string, value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException({
      message: 'i18n:errors.theme.invalidValue',
      key,
    });
  }

  return value.trim();
}

export function sanitizeTheme(input: Record<string, unknown>): BusinessTheme {
  const theme: BusinessTheme = {};

  for (const [key, raw] of Object.entries(input)) {
    if (raw === null || raw === undefined || raw === '') {
      continue;
    }

    const value = assertString(key, raw);

    if ((COLOUR_KEYS as readonly string[]).includes(key)) {
      if (!COLOUR.test(value)) {
        throw new BadRequestException({
          message: 'i18n:errors.theme.invalidColour',
          key,
        });
      }
      theme[key] = value;
      continue;
    }

    if (key === 'radius') {
      if (!LENGTH.test(value)) {
        throw new BadRequestException({
          message: 'i18n:errors.theme.invalidLength',
          key,
        });
      }
      theme.radius = value;
      continue;
    }

    if (key === 'defaultMode') {
      if (!MODES.has(value)) {
        throw new BadRequestException({
          message: 'i18n:errors.theme.invalidMode',
          key,
        });
      }
      theme.defaultMode = value;
      continue;
    }

    if (key === 'logoUrl') {
      if (!/^(https:\/\/[^\s"'<>]+|\/[^\s"'<>]*)$/.test(value)) {
        throw new BadRequestException({
          message: 'i18n:errors.theme.invalidLogo',
          key,
        });
      }
      theme.logoUrl = value;
      continue;
    }

    throw new BadRequestException({
      message: 'i18n:errors.theme.unknownKey',
      key,
    });
  }

  return theme;
}
