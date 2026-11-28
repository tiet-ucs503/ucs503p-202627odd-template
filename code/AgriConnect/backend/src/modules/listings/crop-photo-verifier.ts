import { AppError } from '../../common/app-error.js';
import { getEnv } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { resolveGeminiModel } from '../assistant/assistant.service.js';

export interface CropPhotoVerificationResult {
  matches: boolean;
  detectedProduce: string;
  confidence: number;
  reason: string;
}

type CropPhotoVerifierMock = (
  crop: string,
  category: string,
  file: Express.Multer.File,
) => Promise<CropPhotoVerificationResult> | CropPhotoVerificationResult;

let testVerifierMock: CropPhotoVerifierMock | null = null;

/** Test hook to mock AI crop photo verification deterministically in unit tests. */
export function setCropPhotoVerifierMockForTests(mock: CropPhotoVerifierMock | null): void {
  testVerifierMock = mock;
}

interface GeminiVisionResponse {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
    finishReason?: string;
  }[];
  error?: { message?: string; status?: string; code?: number };
}

/**
 * Verifies that an uploaded photo matches the declared agricultural crop using Gemini Vision.
 *
 * Rules:
 * - Accept: Harvested produce (grains, fruits, vegetables, spices), live crops in field,
 *   plants, crates/sacks of produce, or close-ups of produce.
 * - Reject: Mismatched crops (e.g. wheat photo for dragon fruit, potato photo for mango)
 *   or non-agricultural images (screenshots, vehicles, pets, selfies, documents).
 * - Fallback: If GEMINI_API_KEY is not configured (offline dev / CI), permit upload with a warning.
 */
export async function verifyCropPhoto(
  crop: string,
  category: string,
  variety: string | null | undefined,
  file: Express.Multer.File,
): Promise<CropPhotoVerificationResult> {
  if (testVerifierMock) {
    return testVerifierMock(crop, category, file);
  }

  const env = getEnv();
  if (!env.GEMINI_API_KEY) {
    logger.warn(
      { crop, filename: file.originalname },
      'Skipping AI crop photo verification because GEMINI_API_KEY is not configured',
    );
    return {
      matches: true,
      detectedProduce: crop,
      confidence: 1.0,
      reason: 'Bypassed due to missing GEMINI_API_KEY in local/offline environment',
    };
  }

  const model = resolveGeminiModel(env.GEMINI_MODEL);
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  );
  url.searchParams.set('key', env.GEMINI_API_KEY);

  const prompt = [
    'You are an expert agricultural commodity visual auditor for AgriConnect, an Indian farm-to-market platform.',
    'A farmer is listing an agricultural harvest with the following details:',
    `- Declared Crop Name: "${crop}"`,
    `- Declared Category: "${category}"`,
    variety ? `- Declared Variety: "${variety}"` : '',
    '',
    'Carefully inspect the attached image:',
    '1. Does this photo depict the declared crop or a genuine farm/harvest representation of it?',
    '   - Accept: Harvested produce, grains in sacks/heaps, crates/boxes of this crop, live crop in farmland/orchard/field, or plant/vine/tree of this crop.',
    '   - Reject: An ENTIRELY DIFFERENT crop (e.g., showing wheat grains when declared crop is dragon fruit, showing tomatoes when declared is potatoes, showing mangoes when declared is onions).',
    '   - Reject: Non-agricultural subjects (vehicles, machinery without produce, random documents, screenshots, memes, pets, people with no produce).',
    '',
    'Respond ONLY with a valid JSON object matching this schema:',
    '{',
    '  "matches": boolean,',
    '  "detectedProduce": string,',
    '  "confidence": number,',
    '  "reason": string',
    '}',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const base64Data = file.buffer.toString('base64');
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inline_data: {
                  mime_type: file.mimetype,
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          response_mime_type: 'application/json',
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      const errPayload = (await response.json().catch(() => ({}))) as GeminiVisionResponse;
      logger.warn(
        { status: response.status, err: errPayload },
        'Gemini crop verification API returned non-200; permitting upload with fallback',
      );
      return {
        matches: true,
        detectedProduce: crop,
        confidence: 0.5,
        reason: 'Verification service temporarily unavailable; permitted fallback',
      };
    }

    const payload = (await response.json()) as GeminiVisionResponse;
    const rawText = payload.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '{}';
    const parsed = JSON.parse(rawText) as Partial<CropPhotoVerificationResult>;

    const matches = typeof parsed.matches === 'boolean' ? parsed.matches : true;
    const detectedProduce = parsed.detectedProduce ?? 'Unidentified';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.8;
    const reason = parsed.reason ?? '';

    return { matches, detectedProduce, confidence, reason };
  } catch (error) {
    logger.warn({ error, crop }, 'Gemini vision request failed; permitting upload with fallback');
    return {
      matches: true,
      detectedProduce: crop,
      confidence: 0.5,
      reason: 'Verification network timeout; permitted fallback',
    };
  }
}

/**
 * Validates a batch of photos for a listing. Throws AppError(400) if any photo fails.
 */
export async function verifyCropPhotosMatchListing(
  listing: { crop: string; category: string; variety?: string | null },
  files: Express.Multer.File[],
): Promise<void> {
  for (const file of files) {
    const result = await verifyCropPhoto(listing.crop, listing.category, listing.variety, file);
    if (!result.matches) {
      throw new AppError(
        400,
        'PHOTO_CROP_MISMATCH',
        `Photo "${file.originalname}" does not match declared crop "${listing.crop}". Detected produce: "${result.detectedProduce}". Please upload a photo of your ${listing.crop}.`,
        {
          fields: {
            photos: [
              `Photo "${file.originalname}" does not match declared crop "${listing.crop}". Detected: "${result.detectedProduce}".`,
            ],
          },
        },
      );
    }
  }
}
