import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '../common/app-error.js';
import { getEnv } from '../config/env.js';

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

let client: SupabaseClient | undefined;

function getStorageClient(): SupabaseClient {
  const env = getEnv();
  client ??= createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export interface StoredListingPhoto {
  storagePath: string;
  publicUrl: string;
}

export function isSupportedImageBuffer(
  mimetype: string,
  buffer: Buffer,
): boolean {
  if (mimetype === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimetype === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    );
  }
  if (mimetype === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

export async function uploadListingPhoto(
  listingId: string,
  file: Express.Multer.File,
): Promise<StoredListingPhoto> {
  const extension = EXTENSIONS[file.mimetype];
  if (!extension) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Only JPEG, PNG, and WebP are allowed');
  }
  if (!isSupportedImageBuffer(file.mimetype, file.buffer)) {
    throw new AppError(
      415,
      'UNSUPPORTED_MEDIA_TYPE',
      'File contents do not match the declared image type',
    );
  }

  const env = getEnv();
  const storagePath = `${listingId}/${randomUUID()}.${extension}`;
  const bucket = getStorageClient().storage.from(env.SUPABASE_LISTINGS_BUCKET);
  const { error } = await bucket.upload(storagePath, file.buffer, {
    contentType: file.mimetype,
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Unable to store listing photo', {
      cause: error,
      isOperational: false,
    });
  }

  const { data } = bucket.getPublicUrl(storagePath);
  return { storagePath, publicUrl: data.publicUrl };
}

export async function deleteListingPhotos(storagePaths: string[]): Promise<void> {
  if (storagePaths.length === 0) {
    return;
  }

  const env = getEnv();
  const { error } = await getStorageClient()
    .storage.from(env.SUPABASE_LISTINGS_BUCKET)
    .remove(storagePaths);

  if (error) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Unable to delete listing photo', {
      cause: error,
      isOperational: false,
    });
  }
}
