import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const token = process.env.BOT_TOKEN;
  if (!token) return NextResponse.json({ error: 'BOT_TOKEN nicht gesetzt' }, { status: 500 });

  try {
    const body = await request.json();
    const res = await fetch('https://discord.com/api/v10/users/@me', {
      method: 'PATCH',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data.message || 'Fehler' }, { status: res.status });
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Netzwerkfehler' }, { status: 500 });
  }
}
