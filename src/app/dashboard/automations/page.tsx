'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can } from '@/lib/permissions';

interface Automation {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  config: Record<string, any>;
  created_at: string;
}

export default function AutomationsPage() {
  const supabase = createClientSupabaseClient();
  const [myRole, setMyRole]           = useState<UserRole | null>(null);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (p) setMyRole(p.role as UserRole);
      // Load automations if table exists
      try {
        const { data } = await supabase.from('automations').select('*').order('created_at', { ascending: false });
        setAutomations(data || []);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  if (!myRole || !can.isTopManagement(myRole)) {
    return <div className="text-center py-12 text-gray-400">Kein Zugriff.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">⚙️ Automatisierungen</h1>
        <p className="text-gray-500 text-sm mt-1">Automatische Aktionen konfigurieren</p>
      </div>

      {automations.length === 0 ? (
        <div className="bg-[#13151f] border border-white/[0.06] rounded-2xl p-12 text-center">
          <p className="text-4xl mb-3">⚙️</p>
          <p className="text-gray-500 text-sm">Keine Automatisierungen konfiguriert.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => (
            <div key={a.id} className="bg-[#13151f] border border-white/[0.06] rounded-2xl px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-white font-medium">{a.name}</p>
                <p className="text-gray-500 text-xs mt-0.5">{a.trigger} → {a.action}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${a.enabled ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
                {a.enabled ? '● Aktiv' : '○ Inaktiv'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
