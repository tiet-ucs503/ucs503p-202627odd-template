import { redirect } from 'next/navigation';
import { createClient } from '../../lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect('/login');
  const email = typeof claims.email === 'string' ? claims.email : 'authenticated user';
  return <main><h1>Academic dashboard</h1><p>Signed in as {email}</p></main>;
}

