import type { FilePurpose, FileVisibility } from '../../database/schema';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

export const ALLOWED_TYPES: Record<FilePurpose, string[]> = {
  prescription: [...IMAGE_TYPES, 'application/pdf'],
  // svg is allowed only here: a logo is chosen by an owner for their own
  // workspace, not uploaded by a customer, and vector logos are the norm.
  'business-logo': [...IMAGE_TYPES, 'image/svg+xml'],
  'product-image': IMAGE_TYPES,
  'content-image': IMAGE_TYPES,
  'content-video': VIDEO_TYPES,
  attachment: [
    ...IMAGE_TYPES,
    ...VIDEO_TYPES,
    'application/pdf',
    'text/csv',
    'text/plain',
  ],
};

/**
 * A file rendered to anonymous visitors needs a stable address, so it goes
 * under the public prefix. Anything holding customer data does not.
 */
export const DEFAULT_VISIBILITY: Record<FilePurpose, FileVisibility> = {
  prescription: 'private',
  'business-logo': 'public',
  'product-image': 'private',
  'content-image': 'public',
  'content-video': 'public',
  attachment: 'private',
};

/** Video needs more room than a receipt scan. */
export function maxBytesFor(contentType: string): number {
  return contentType.startsWith('video/') ? MAX_VIDEO_BYTES : MAX_UPLOAD_BYTES;
}
