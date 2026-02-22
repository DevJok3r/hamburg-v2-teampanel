import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { can } from '@/lib/permissions';
import { UserRole } from '@/types';

export async function POST(request: NextRequest) {
  // 1. Prüfen ob der anfragende User eingeloggt und berechtigt ist
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
  }

  // Eigenes Profil laden um Rolle zu prüfen
  const { data: actorProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (!actorProfile || !can.createUser(actorProfile.role)) {
    return NextResponse.json({ error: 'Keine Berechtigung' }, { status: 403 });
  }

  // 2. Request-Body validieren
  const body = await request.json();
  const { username, password, role } = body as {
    username: string;
    password: string;
    role: UserRole;
  };

  if (!username || !password || !role) {
    return NextResponse.json({ error: 'Fehlende Felder' }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Passwort muss mindestens 8 Zeichen lang sein' },
      { status: 400 }
    );
  }

  if (!can.changeUserRole(actorProfile.role, role)) {
    return NextResponse.json(
      { error: 'Du kannst keine Benutzer mit dieser Rolle anlegen' },
      { status: 403 }
    );
  }

  // 3. Benutzer im Supabase Auth anlegen
  const adminSupabase = createAdminSupabaseClient();
  const fakeEmail = `${username.toLowerCase()}@hamburg-v2.internal`;

  const { data: newUser, error: createError } = await adminSupabase.auth.admin.createUser({
    email: fakeEmail,
    password,
    email_confirm: true,
  });

  if (createError) {
    if (createError.message.includes('already registered')) {
      return NextResponse.json({ error: 'Benutzername bereits vergeben' }, { status: 409 });
    }
    return NextResponse.json({ error: createError.message }, { status: 500 });
  }

  // 4. Profil in profiles-Tabelle anlegen
  const { error: profileError } = await adminSupabase
    .from('profiles')
    .insert({
      id: newUser.user!.id,
      username: username.toLowerCase(),
      role,
      created_by: session.user.id,
    });

  if (profileError) {
    // Rollback: Auth-User löschen wenn Profil-Anlage fehlschlägt
    await adminSupabase.auth.admin.deleteUser(newUser.user!.id);
    return NextResponse.json({ error: 'Profil konnte nicht angelegt werden' }, { status: 500 });
  }

  // 5. Audit Log schreiben
  await adminSupabase.from('audit_logs').insert({
    actor_id: session.user.id,
    action: 'user.created',
    target_id: newUser.user!.id,
    metadata: { username, role },
  });

  return NextResponse.json({ success: true, userId: newUser.user!.id }, { status: 201 });
}