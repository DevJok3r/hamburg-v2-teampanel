import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { trigger, data } = await request.json();

  const { data: automations } = await supabase
    .from('automations')
    .select('*, webhooks(url)')
    .eq('trigger', trigger)
    .eq('is_active', true);

  if (!automations || automations.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  let sent = 0;
  for (const auto of automations) {
    const webhook = auto.webhooks;
    if (!webhook?.url) continue;

    let message = auto.message
      .replace('{titel}',     data.titel     || '')
      .replace('{datum}',     data.datum     || '')
      .replace('{ersteller}', data.ersteller || '')
      .replace('{mitglied}',  data.mitglied  || '')
      .replace('{von}',       data.von       || '')
      .replace('{bis}',       data.bis       || '')
      .replace('{grund}',     data.grund     || '')
      .replace('{status}',    data.status    || '');

    const pings = (auto.ping_roles || []).map((r: string) => `<@&${r}>`).join(' ');
    const content = pings ? `${pings}\n${message}` : message;

    try {
      await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      sent++;
    } catch {}
  }

  return NextResponse.json({ sent });
}