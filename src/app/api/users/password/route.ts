import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  // Nur Top Management darf Passwörter ändern
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  const { data: actorProfile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single();

  if (!actorProfile || actorProfile.role !== 'top_management') {
    return NextResponse.json({ error: 'Nur Top Management darf Passwörter ändern' }, { status: 403 });
  }

  const { userId, newPassword } = await request.json();

  if (!userId || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 });
  }

  const adminSupabase = createAdminSupabaseClient();

  const { error } = await adminSupabase.auth.admin.updateUserById(userId, {
    password: newPassword,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Audit Log
  await adminSupabase.from('audit_logs').insert({
    actor_id: session.user.id,
    action: 'user.password_changed',
    target_id: userId,
    metadata: {},
  });

  return NextResponse.json({ success: true });
}