import apiClient from './client';

/**
 * POST /uploads/images
 * Sends a multipart/form-data request with the file in the `file` field.
 * Returns { url: "/uploads/images/uuid.ext" }
 */
export const uploadImage = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return apiClient.post('/uploads/images', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};