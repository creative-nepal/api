import type { LocalizationOptions } from 'better-auth-localization';
import { FALLBACK_LANGUAGE, LANGUAGE_HEADER } from '../i18n/i18n.constants';

const ne = {
  USER_NOT_FOUND: 'प्रयोगकर्ता फेला परेन',
  FAILED_TO_CREATE_USER: 'प्रयोगकर्ता सिर्जना गर्न सकिएन',
  FAILED_TO_CREATE_SESSION: 'सत्र सिर्जना गर्न सकिएन',
  FAILED_TO_UPDATE_USER: 'प्रयोगकर्ता अद्यावधिक गर्न सकिएन',
  FAILED_TO_GET_SESSION: 'सत्र प्राप्त गर्न सकिएन',
  INVALID_PASSWORD: 'पासवर्ड मिलेन',
  INVALID_EMAIL: 'इमेल ठेगाना मान्य छैन',
  INVALID_EMAIL_OR_PASSWORD: 'इमेल वा पासवर्ड मिलेन',
  INVALID_TOKEN: 'टोकन मान्य छैन',
  TOKEN_EXPIRED: 'टोकनको म्याद सकियो',
  EMAIL_NOT_VERIFIED: 'इमेल प्रमाणित भएको छैन',
  PASSWORD_TOO_SHORT: 'पासवर्ड धेरै छोटो भयो',
  PASSWORD_TOO_LONG: 'पासवर्ड धेरै लामो भयो',
  USER_ALREADY_EXISTS: 'यो प्रयोगकर्ता पहिले नै दर्ता भइसकेको छ',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'यो इमेल पहिले नै प्रयोगमा छ, अर्को इमेल प्रयोग गर्नुहोस्',
  ACCOUNT_NOT_FOUND: 'खाता फेला परेन',
  SESSION_EXPIRED: 'सत्रको म्याद सकियो, फेरि साइन इन गर्नुहोस्',
  EMAIL_ALREADY_VERIFIED: 'इमेल पहिले नै प्रमाणित भइसकेको छ',
  VALIDATION_ERROR: 'दिइएको विवरण मान्य छैन',
  MISSING_FIELD: 'आवश्यक विवरण छुटेको छ',
  INVALID_ORIGIN: 'अनुरोधको स्रोत मान्य छैन',
  MISSING_OR_NULL_ORIGIN: 'अनुरोधको स्रोत छुटेको छ',
  YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION:
    'तपाईंलाई नयाँ व्यवसाय सिर्जना गर्ने अनुमति छैन',
  YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS:
    'तपाईंले सिर्जना गर्न सक्ने व्यवसायको अधिकतम संख्या पुगिसक्यो',
};

const en = {
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'That email is already registered. Use another one, or sign in instead.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
};

export const authLocalization: LocalizationOptions<{
  ne: typeof ne;
  en: typeof en;
}> = {
  defaultLocale: FALLBACK_LANGUAGE,
  fallbackLocale: FALLBACK_LANGUAGE,
  translations: { ne, en },
  getLocale: (request) => {
    if (!request) {
      return FALLBACK_LANGUAGE;
    }

    const explicit = request.headers.get(LANGUAGE_HEADER);

    if (explicit === 'ne' || explicit === 'en') {
      return explicit;
    }

    const accept = request.headers.get('accept-language') ?? '';

    return accept.toLowerCase().startsWith('ne') ? 'ne' : FALLBACK_LANGUAGE;
  },
};
