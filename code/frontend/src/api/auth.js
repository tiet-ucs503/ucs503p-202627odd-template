import apiClient from './client';

/**
 * Register a new user.
 * @param {{ username: string, email: string, password: string, full_name: string }} data
 * @returns {Promise<AxiosResponse>} Created user object (no access_token)
 */
export const register = (data) => apiClient.post('/auth/register', data);

/**
 * Log in with username + password (JSON body, Content-Type: application/json).
 * On success response.data.access_token must be stored by the caller.
 * @param {{ username: string, password: string }} data
 * @returns {Promise<AxiosResponse>}
 */
export const login = (data) =>
  apiClient.post('/auth/login', data, {
    headers: { 'Content-Type': 'application/json' },
  });

/**
 * Log out the current user (server-side session invalidation).
 * The caller is responsible for removing the token from localStorage.
 * @returns {Promise<AxiosResponse>}
 */
export const logout = () => apiClient.post('/auth/logout');

/**
 * Fetch the currently authenticated user's profile.
 * Requires a valid JWT in localStorage (attached automatically by the request interceptor).
 * @returns {Promise<AxiosResponse>}
 */
export const getMe = () => apiClient.get('/users/me');
