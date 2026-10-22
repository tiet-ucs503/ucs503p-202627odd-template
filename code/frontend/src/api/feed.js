import apiClient from './client';

/** GET /feed?skip=0&limit=20  (Bearer required) */
export const getFeed = (skip = 0, limit = 20) =>
  apiClient.get('/feed', { params: { skip, limit } });