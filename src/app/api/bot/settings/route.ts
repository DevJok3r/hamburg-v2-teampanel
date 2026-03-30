import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { action, value } = await req.json();
    const token = process.env.DISCORD_BOT_TOKEN;
    if (!token) return NextResponse.json({ error: 'DISCORD_BOT_TOKEN nicht gesetzt' }, { status: 500 });

    const base    = 'https://discord.com/api/v10';
    const headers = { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' };

    if (action === 'get_info') {
      const res  = await fetch(`${base}/users/@me`, { headers });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message }, { status: res.status });
      return NextResponse.json({
        id:            data.id,
        username:      data.username,
        discriminator: data.discriminator,
        avatar:        data.avatar ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png?size=256` : null,
        banner:        data.banner ? `https://cdn.discordapp.com/banners/${data.id}/${data.banner}.png?size=512` : null,
        bot:           data.bot,
      });
    }

    if (action === 'set_username') {
      if (!value || value.length < 2 || value.length > 32) {
        return NextResponse.json({ error: 'Username muss 2-32 Zeichen lang sein' }, { status: 400 });
      }
      const res  = await fetch(`${base}/users/@me`, { method: 'PATCH', headers, body: JSON.stringify({ username: value }) });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message || 'Fehler beim Ändern' }, { status: res.status });
      return NextResponse.json({ success: true, username: data.username });
    }

    if (action === 'set_avatar') {
      // value should be base64 data URL: data:image/png;base64,...
      if (!value || !value.startsWith('data:image')) {
        return NextResponse.json({ error: 'Ungültiges Bildformat' }, { status: 400 });
      }
      const res  = await fetch(`${base}/users/@me`, { method: 'PATCH', headers, body: JSON.stringify({ avatar: value }) });
      const data = await res.json();
      if (!res.ok) return NextResponse.json({ error: data.message || 'Fehler beim Setzen' }, { status: res.status });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unbekannte Aktion' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}