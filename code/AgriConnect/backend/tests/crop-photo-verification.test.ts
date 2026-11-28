import { afterEach, describe, expect, it } from 'vitest';
import { AppError } from '../src/common/app-error.js';
import {
  setCropPhotoVerifierMockForTests,
  verifyCropPhoto,
  verifyCropPhotosMatchListing,
} from '../src/modules/listings/crop-photo-verifier.js';

function createMockImageFile(name: string, content = 'dummy-image-data'): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname: name,
    encoding: '7bit',
    mimetype: 'image/jpeg',
    size: content.length,
    buffer: Buffer.from(content),
    destination: '',
    filename: name,
    path: '',
    stream: null as unknown as Express.Multer.File['stream'],
  };
}

describe('crop-photo-verifier service', () => {
  afterEach(() => {
    setCropPhotoVerifierMockForTests(null);
  });

  it('approves a photo when the detected produce matches the declared crop', async () => {
    setCropPhotoVerifierMockForTests((crop) => ({
      matches: true,
      detectedProduce: crop,
      confidence: 0.98,
      reason: `Photo accurately shows ${crop}`,
    }));

    const file = createMockImageFile('wheat_sack.jpg');
    const result = await verifyCropPhoto('Wheat', 'grains', 'PBW-343', file);

    expect(result.matches).toBe(true);
    expect(result.detectedProduce).toBe('Wheat');
    expect(result.confidence).toBeGreaterThan(0.9);
  });

  it('rejects a photo when the detected produce does not match the declared crop (e.g. wheat for dragon fruit)', async () => {
    setCropPhotoVerifierMockForTests(() => ({
      matches: false,
      detectedProduce: 'Wheat grains',
      confidence: 0.95,
      reason: 'The photo depicts wheat grains in a burlap sack, which does not match Dragon fruit.',
    }));

    const file = createMockImageFile('wheat_grains.jpg');
    const result = await verifyCropPhoto('Dragon fruit', 'fruits', null, file);

    expect(result.matches).toBe(false);
    expect(result.detectedProduce).toBe('Wheat grains');

    // verifyCropPhotosMatchListing throws AppError with PHOTO_CROP_MISMATCH code
    await expect(
      verifyCropPhotosMatchListing({ crop: 'Dragon fruit', category: 'fruits' }, [file]),
    ).rejects.toThrow(AppError);

    try {
      await verifyCropPhotosMatchListing({ crop: 'Dragon fruit', category: 'fruits' }, [file]);
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      const appErr = err as AppError;
      expect(appErr.code).toBe('PHOTO_CROP_MISMATCH');
      expect(appErr.statusCode).toBe(400);
      expect(appErr.message).toContain('Dragon fruit');
      expect(appErr.message).toContain('Wheat grains');
    }
  });

  it('rejects a non-agricultural photo (e.g. vehicle, screenshot)', async () => {
    setCropPhotoVerifierMockForTests(() => ({
      matches: false,
      detectedProduce: 'Motorcycle / vehicle',
      confidence: 0.99,
      reason: 'The photo shows a vehicle, not agricultural produce.',
    }));

    const file = createMockImageFile('vehicle.jpg');
    await expect(
      verifyCropPhotosMatchListing({ crop: 'Basmati Rice', category: 'grains' }, [file]),
    ).rejects.toMatchObject({
      code: 'PHOTO_CROP_MISMATCH',
      statusCode: 400,
    });
  });

  it('permits uploads when GEMINI_API_KEY is not set (offline/fallback mode)', async () => {
    // With testVerifierMock null and no mock API key:
    setCropPhotoVerifierMockForTests(null);
    const file = createMockImageFile('produce.jpg');
    const result = await verifyCropPhoto('Potato', 'vegetables', null, file);
    expect(result.matches).toBe(true);
  });
});
