import apiClient from './client';

/** GET /users/{user_id} */
export const getUser = (userId) => apiClient.get(`/users/${userId}`);

/** PATCH /users/me */
export const updateMe = (data) => apiClient.patch('/users/me', data);

/** GET /users?search={query} */
export const searchUsers = (query) =>
  apiClient.get('/users', { params: { search: query } });

/** GET /users/{user_id}/followers */
export const getFollowers = (userId) =>
  apiClient.get(`/users/${userId}/followers`);

/** GET /users/{user_id}/following */
export const getFollowing = (userId) =>
  apiClient.get(`/users/${userId}/following`);