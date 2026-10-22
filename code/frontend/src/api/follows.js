import apiClient from './client';

/** POST /follows  { followed_id } */
export const followUser = (followedId) =>
  apiClient.post('/follows', { followed_id: followedId });

/** DELETE /follows/{followed_id} */
export const unfollowUser = (followedId) =>
  apiClient.delete(`/follows/${followedId}`);