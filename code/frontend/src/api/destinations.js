import apiClient from './client';

/** GET /destinations?search={query} */
export const searchDestinations = (query) =>
  apiClient.get('/destinations', { params: { search: query } });

/** GET /destinations/{destination_id} */
export const getDestination = (destinationId) =>
  apiClient.get(`/destinations/${destinationId}`);

/** GET /destinations/{destination_id}/posts */
export const getDestinationPosts = (destinationId) =>
  apiClient.get(`/destinations/${destinationId}/posts`);

/** GET /destinations/{destination_id}/travelers */
export const getDestinationTravelers = (destinationId) =>
  apiClient.get(`/destinations/${destinationId}/travelers`);