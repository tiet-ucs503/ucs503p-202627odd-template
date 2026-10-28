import LoginSignUpSection from './login-signup';

export function AuthPage({ initialMode = 'login', onNavigateHome }) {
  return <LoginSignUpSection initialTab={initialMode} onNavigateHome={onNavigateHome} />;
}
