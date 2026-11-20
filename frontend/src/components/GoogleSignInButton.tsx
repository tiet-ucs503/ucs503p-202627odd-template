import { useEffect, useRef, useState } from 'react';

// "Sign in with Google", using Google's own button (Google Identity Services).
// Google's script draws the button and, once the person signs in, hands back a
// signed ID token. That token goes to our backend, which checks it with Google's
// library before trusting it (backend/services/google_auth.py). MathVerse never
// sees a Google password.

const GIS_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleIdApi {
  initialize: (config: { client_id: string; callback: (r: { credential?: string }) => void; ux_mode?: 'popup' }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let loading: Promise<GoogleIdApi> | null = null;

/** Loads Google's sign-in script once, only when the button is actually shown. */
function loadGoogleIdentity(): Promise<GoogleIdApi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = GIS_SRC;
      script.async = true;
      script.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('no api')));
      script.onerror = () => {
        loading = null;
        reject(new Error('Google sign-in could not be loaded.'));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

export default function GoogleSignInButton({
  clientId,
  text,
  onCredential,
}: {
  clientId: string;
  text: 'signin_with' | 'continue_with';
  onCredential: (credential: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Google keeps the first callback it is given; this ref lets it always reach the latest one,
  // so a role picked after the button appeared is still the role that is used.
  const latest = useRef(onCredential);
  latest.current = onCredential;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleIdentity()
      .then((gis) => {
        if (cancelled || !box.current) return;
        gis.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          callback: (response) => {
            if (response.credential) latest.current(response.credential);
          },
        });
        gis.renderButton(box.current, { theme: 'filled_black', size: 'large', shape: 'pill', text, width: 300 });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (failed) {
    return <p className="text-[11px] text-gray-400 text-center">Google sign-in is unavailable right now. Use your email and password.</p>;
  }
  return <div ref={box} data-google-button className="flex justify-center min-h-[44px]" />;
}
