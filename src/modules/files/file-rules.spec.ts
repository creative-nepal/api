import { FILE_PURPOSES } from '../../database/schema';
import {
  ALLOWED_TYPES,
  DEFAULT_VISIBILITY,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_BYTES,
  maxBytesFor,
} from './file-rules';

describe('file rules', () => {
  it('covers every purpose, so a new one cannot be added without a decision', () => {
    for (const purpose of FILE_PURPOSES) {
      expect(ALLOWED_TYPES[purpose]).toBeDefined();
      expect(DEFAULT_VISIBILITY[purpose]).toBeDefined();
    }
  });

  describe('visibility defaults', () => {
    it('keeps anything holding customer data private', () => {
      expect(DEFAULT_VISIBILITY.prescription).toBe('private');
      expect(DEFAULT_VISIBILITY.attachment).toBe('private');
      expect(DEFAULT_VISIBILITY['product-image']).toBe('private');
    });

    it('makes what anonymous visitors must see public', () => {
      expect(DEFAULT_VISIBILITY['business-logo']).toBe('public');
      expect(DEFAULT_VISIBILITY['content-image']).toBe('public');
      expect(DEFAULT_VISIBILITY['content-video']).toBe('public');
    });
  });

  describe('content types', () => {
    it('refuses svg where a customer supplies the file', () => {
      // svg can carry script; only an owner's own logo may be one.
      expect(ALLOWED_TYPES['product-image']).not.toContain('image/svg+xml');
      expect(ALLOWED_TYPES['content-image']).not.toContain('image/svg+xml');
      expect(ALLOWED_TYPES.prescription).not.toContain('image/svg+xml');
      expect(ALLOWED_TYPES['business-logo']).toContain('image/svg+xml');
    });

    it('allows video only where video makes sense', () => {
      expect(ALLOWED_TYPES['content-video']).toContain('video/mp4');
      expect(ALLOWED_TYPES.attachment).toContain('video/mp4');
      expect(ALLOWED_TYPES['product-image']).not.toContain('video/mp4');
      expect(ALLOWED_TYPES.prescription).not.toContain('video/mp4');
    });

    it('never allows html or javascript anywhere', () => {
      for (const purpose of FILE_PURPOSES) {
        expect(ALLOWED_TYPES[purpose]).not.toContain('text/html');
        expect(ALLOWED_TYPES[purpose]).not.toContain('application/javascript');
      }
    });
  });

  describe('size limits', () => {
    it('gives video more room than a document', () => {
      expect(maxBytesFor('video/mp4')).toBe(MAX_VIDEO_BYTES);
      expect(maxBytesFor('image/png')).toBe(MAX_UPLOAD_BYTES);
      expect(maxBytesFor('application/pdf')).toBe(MAX_UPLOAD_BYTES);
    });

    it('treats an unknown type as a document, not a video', () => {
      expect(maxBytesFor('application/octet-stream')).toBe(MAX_UPLOAD_BYTES);
    });
  });
});
