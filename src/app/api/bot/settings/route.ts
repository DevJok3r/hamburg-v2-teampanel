import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { action, value } = await req.json();
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 });

    const base = 'https://discord.com/api/v10';
    const headers = { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' };

    if (action === 'set_username') {
      const res = await fetch(`${base}/users/@me`, { method: 'PATCH', headers, body: JSON.stringify({ username: value }) });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
      return NextResponse.json({ success: true, username: data.username });
    }

    if (action === 'set_avatar') {
      const res = await fetch(`${base}/users/@me`, { method: 'PATCH', headers, body: JSON.stringify({ avatar: value }) });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
      return NextResponse.json({ success: true });
    }

    if (action === 'set_status') {
      // Status wird über Supabase gespeichert, Bot liest beim Start
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}