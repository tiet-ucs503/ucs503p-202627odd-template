/**
 * mediaUrl.js - Resolve backend-relative media paths to absolute URLs.
 *
 * The backend returns image URLs like "/uploads/images/xyz.jpg".
 * These must be resolved against the backend origin (localhost:8000),
 * not the frontend origin (localhost:5173).
 *
 * Usage:
 *   import { mediaUrl } from '../utils/mediaUrl';
 *   <img src={mediaUrl(post.image_url)} />
 */

const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Convert a backend-relative path to a fully-qualified URL.
 * Returns the value unchanged if it is already an absolute URL or falsy.
 *
 * @param {string|null|undefined} path
 * @returns {string}
 */
export function mediaUrl(path) {
  if (!path) return '';
  // Already absolute (http:// or https://)
  if (/^https?:\/\//i.test(path)) return path;
  // Relative path — prepend backend origin
  return `${API_ORIGIN}${path.startsWith('/') ? '' : '/'}${path}`;
}