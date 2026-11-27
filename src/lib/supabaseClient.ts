import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { apiUrl } from './apiConfig';

// Browser-safe Supabase configuration - fails closed if env vars are missing
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Public Supabase client for client-side subscriptions and public storage.
 * Fails closed (null) if env vars are missing.
 */
export const supabaseClient: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : null;

/**
 * Retrieve the current Supabase access token directly from active session if present.
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  if (supabaseClient) {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession();
      if (!error && session?.access_token) {
        return session.access_token;
      }
    } catch (err) {
      console.warn('[AUTH TRACE] Error getting session access token:', err);
    }
  }
  return null;
}

/**
 * Backend API Client Helper
 * Uses same-origin cookies and CSRF headers.
 */
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string> || {}),
  };

  const targetUrl = apiUrl(endpoint);

  const response = await fetch(targetUrl, {
    credentials: 'same-origin',
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data?.message || data?.error || `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}
