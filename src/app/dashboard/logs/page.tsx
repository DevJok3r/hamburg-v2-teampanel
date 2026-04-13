'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can } from '@/lib/permissions';

interface SystemLog {
  id: string;
  action: string;
  user_id?: string;
  target_id?: string;
  details?: Record<string, any>;
  created_at: string;
  actor?: { username: string };
  target?: { username: string };
}

const ACTION_COLORS: Record<string, string> = {
  user_created: 'text-green-400', user_deactivated: 'text-red-400', user_activated: 'text-green-400',
  role_changed: 'text-purple-400', password_changed: 'text-yellow-400', login: 'text-blue-400',
  absence_approved: 'text-green-400', absence_rejected: 'text-red-400',
  warning_added: 'text-orange-400', warning_removed: 'text-gray-400',
};

export default function LogsPage() {
  const supabase = createClientSupabaseClient();
  const [myRole, setMyRole]   = useState<UserRole | null>(null);
  const [logs, setLogs]       = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (p) setMyRole(p.role as UserRole);
      const { data } = await supabase.from('system_logs')
        .select('*, actor:user_id(username), target:target_id(username)')
        .order('created_at', { ascending: false })
        .limit(300);
      setLogs(data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;
  if (!myRole || !can.isTopManagement(myRole)) return <div className="text-center py-12 text-gray-400">Kein Zugriff.</div>;

  const filtered = logs.filter(l =>
    !search || l.action.includes(search.toLowerCase()) ||
    l.actor?.username.toLowerCase().includes(search.toLowerCase()) ||
    l.target?.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">System Logs</h1>
        <p className="text-gray-500 text-sm mt-1">{logs.length} Einträge</p>
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suchen..."
        className="bg-[#13151f] border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/50 w-72" />

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="bg-[#13151f] border border-white/[0.06] rounded-2xl p-12 text-center">
            <p className="text-gray-500 text-sm">Keine Logs gefunden.</p>
          </div>
        ) : filtered.map(l => (
          <div key={l.id} className="bg-[#13151f] border border-white/[0.05] hover:border-white/10 rounded-2xl px-5 py-3.5 flex items-start justify-between gap-4 transition">
            <div className="flex items-start gap-3 min-w-0">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${ACTION_COLORS[l.action] || 'text-gray-300'}`}>
                    {l.action.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                  {l.actor && <span className="text-blue-400/70 text-xs">{l.actor.username}</span>}
                  {l.target && <><span className="text-gray-700 text-xs">→</span><span className="text-purple-400/70 text-xs">{l.target.username}</span></>}
                </div>
                {l.details && Object.keys(l.details).length > 0 && (
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {Object.entries(l.details).slice(0,3).map(([k,v]) => (
                      <span key={k} className="text-gray-700 text-xs bg-white/[0.03] px-2 py-0.5 rounded font-mono">{k}: {String(v).substring(0,30)}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <span className="text-gray-700 text-xs flex-shrink-0">{new Date(l.created_at).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
