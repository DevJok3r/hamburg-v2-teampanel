import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const token = process.env.BOT_TOKEN;
  if (!token) return NextResponse.json({ error: 'BOT_TOKEN nicht gesetzt' }, { status: 500 });

  const { searchParams } = new URL(request.url);
  const guildId = searchParams.get('guildId');
  if (!guildId) return NextResponse.json({ error: 'guildId fehlt' }, { status: 400 });

  try {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
      cache: 'no-store',
    });
    const channels = await res.json();
    const textChannels = (channels || [])
      .filter((c: any) => c.type === 0)
      .sort((a: any, b: any) => a.position - b.position);
    return NextResponse.json({ channels: textChannels });
  } catch {
    return NextResponse.json({ error: 'Fehler' }, { status: 500 });
  }
}
