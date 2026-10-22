import apiClient from './client';

/** POST /posts */
export const createPost = (data) => apiClient.post('/posts', data);

/** GET /posts/{post_id} */
export const getPost = (postId) => apiClient.get(`/posts/${postId}`);

/** GET /posts */
export const getPosts = () => apiClient.get('/posts');

/** DELETE /posts/{post_id} */
export const deletePost = (postId) => apiClient.delete(`/posts/${postId}`);