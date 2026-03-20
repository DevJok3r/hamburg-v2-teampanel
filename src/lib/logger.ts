import { createClientSupabaseClient } from '@/lib/supabase/client';

export type LogCategory =
  | 'auth' | 'entries' | 'warnings' | 'absences' | 'conferences'
  | 'users' | 'roles' | 'applications' | 'system' | 'todos'
  | 'requests' | 'orders' | 'exams' | 'forms' | 'balance' | 'modlogs';

export async function log(
  category: LogCategory,
  action: string,
  details: Record<string, any> = {},
  targetId?: string
) {
  try {
    const supabase = createClientSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('system_logs').insert({
      category,
      action,
      actor_id: user.id,
      target_id: targetId || null,
      details,
    });
  } catch {}
}