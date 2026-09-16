// Athlete landing and authentication gateway using Google OAuth.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";

export default function LoginPage() {
  const { loginWithGoogle, authError } = useAuth();
  const [localError, setLocalError] = useState(null);
  const googleButtonRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !googleButtonRef.current) return;

    let cancelled = false;
    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setLocalError(null);
          try {
            await loginWithGoogle({ token: credential });
          } catch (_) {}
        },
      });
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = renderButton;
      script.onerror = () => setLocalError("Google Sign-In could not be loaded.");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientId, loginWithGoogle]);

  return (
    <div className="login-page-container" data-testid="login-page">
      <div className="login-hero-card">
        <div className="login-badge-wrap">
          <span className="login-badge-text">AI Form Analyzer | Biomechanics</span>
        </div>

        <h1 className="login-hero-title">Precision Squat Analysis in Real Time</h1>

        <p className="login-hero-subtitle">
          Real-time MediaPipe computer vision tracks your joint kinematics, ensures parallel depth, prevents knee collapse, and calculates your personal form score.
        </p>

        {(authError || localError) && (
          <p className="auth-error-banner" data-testid="auth-error">{localError || authError}</p>
        )}

        <div className="oauth-action-area">
          {clientId ? (
            <div ref={googleButtonRef} data-testid="google-signin-button" />
          ) : (
            <p className="auth-error-banner" data-testid="google-config-error">
              Google Sign-In is not configured for this environment.
            </p>
          )}
          <span className="oauth-hint">Secured by Google Identity | Zero telemetry video</span>
        </div>
      </div>
    </div>
  );
}
