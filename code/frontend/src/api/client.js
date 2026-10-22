/**
 * client.js - Centralized API communication layer for TravelSphere.
 *
 * All backend requests go through this module.
 *
 * - axios instance pre-configured with base URL and default headers.
 * - Request interceptor attaches the JWT Bearer token on every request.
 * - Response interceptor handles errors globally (extended in Chunk 1).
 *
 * Do not call axios directly from pages or components.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL}/api`
  : '/api';

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token if present
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - global error handling
// On 401 Unauthorized, remove the stale token so the request interceptor
// stops attaching it and the AuthContext restore does not retry endlessly.
// Navigation to /login is handled by ProtectedRoute (router-level), not here.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('access_token');
    }
    return Promise.reject(error);
  }
);

export default apiClient;