import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.BOT_TOKEN;
  if (!token) return NextResponse.json({ error: 'BOT_TOKEN nicht gesetzt' }, { status: 500 });

  try {
    const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    });
    const guilds = await guildsRes.json();
    if (!guilds?.length) return NextResponse.json({ roles: [] });

    const guildId = guilds[0].id;
    const rolesRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    });
    const roles = await rolesRes.json();
    const filtered = roles
      .filter((r: any) => r.name !== '@everyone')
      .sort((a: any, b: any) => b.position - a.position);
    return NextResponse.json({ roles: filtered, guildId });
  } catch {
    return NextResponse.json({ error: 'Netzwerkfehler' }, { status: 500 });
  }
}
