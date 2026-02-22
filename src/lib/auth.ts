import { createServerSupabaseClient } from './supabase/server';
import { Profile } from '@/types';
import { redirect } from 'next/navigation';

export async function requireAuth(): Promise<Profile> {
  const supabase = await createServerSupabaseClient();

  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    redirect('/login?error=account_disabled');
  }

  return profile;
}

export async function getOptionalSession() {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}