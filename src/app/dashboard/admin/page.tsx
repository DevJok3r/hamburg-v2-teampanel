'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole, MemberEntry, Warning } from '@/types';
import { can } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [myRole, setMyRole]     = useState<UserRole | null>(null);
  const [loading, setLoading]   = useState(true);
  const [entries, setEntries]   = useState<MemberEntry[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [activeTab, setActiveTab] = useState<'warnings' | 'entries'>('warnings');
  const router = useRouter();
  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();

    if (!profile || !can.viewAdmin(profile.role as UserRole)) {
      router.push('/dashboard');
      return;
    }

    setMyRole(profile.role as UserRole);

    const { data: allEntries } = await supabase
      .from('member_entries')
      .select('*, profiles!member_entries_user_id_fkey(username, role), creator:created_by(username)')
      .order('created_at', { ascending: false });

    const { data: allWarnings } = await supabase
      .from('warnings')
      .select('*, profiles!warnings_user_id_fkey(username, role), creator:created_by(username)')
      .order('created_at', { ascending: false });

    setEntries(allEntries || []);
    setWarnings(allWarnings || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function deleteEntry(id: string) {
    await supabase.from('member_entries').delete().eq('id', id);
    load();
  }

  async function deleteWarning(id: string) {
    await supabase.from('warnings').delete().eq('id', id);
    load();
  }

  if (loading) return (
    <div className="text-gray-400 text-center py-12">Lade...</div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Administrationsbereich</h1>
        <p className="text-gray-400 text-sm mt-1">
          Alle Verwarnungen und Einträge im Überblick
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
          <p className="text-gray-400 text-sm mb-1">Verwarnungen gesamt</p>
          <p className={`text-3xl font-bold ${warnings.length > 0 ? 'text-red-400' : 'text-white'}`}>
            {warnings.length}
          </p>
        </div>
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
          <p className="text-gray-400 text-sm mb-1">Einträge gesamt</p>
          <p className="text-3xl font-bold text-white">{entries.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('warnings')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition
            ${activeTab === 'warnings'
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Verwarnungen ({warnings.length})
        </button>
        <button
          onClick={() => setActiveTab('entries')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition
            ${activeTab === 'entries'
              ? 'bg-blue-600 text-white'
              : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
        >
          Einträge ({entries.length})
        </button>
      </div>

      {/* Verwarnungen */}
      {activeTab === 'warnings' && (
        <div className="space-y-3">
          {warnings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Keine Verwarnungen vorhanden 🎉
            </div>
          ) : (
            warnings.map(w => (
              <div key={w.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full
                                      flex items-center justify-center text-white font-bold text-xs">
                        {(w.profiles as any)?.username?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-medium text-sm">
                        {(w.profiles as any)?.username}
                      </span>
                      {(w.profiles as any)?.role && (
                        <RoleBadge role={(w.profiles as any).role as UserRole} size="xs" />
                      )}
                      <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/30
                                       text-xs px-2 py-0.5 rounded">
                        Verwarnung
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm">{w.reason}</p>
                    <p className="text-gray-500 text-xs mt-2">
                      von {(w.creator as any)?.username} · {new Date(w.created_at).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {myRole && can.deleteEntries(myRole) && (
                    <button onClick={() => deleteWarning(w.id)}
                      className="text-gray-500 hover:text-red-400 transition flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Einträge */}
      {activeTab === 'entries' && (
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              Keine Einträge vorhanden
            </div>
          ) : (
            entries.map(e => (
              <div key={e.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full
                                      flex items-center justify-center text-white font-bold text-xs">
                        {(e.profiles as any)?.username?.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white font-medium text-sm">
                        {(e.profiles as any)?.username}
                      </span>
                      {(e.profiles as any)?.role && (
                        <RoleBadge role={(e.profiles as any).role as UserRole} size="xs" />
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded border
                        ${e.type === 'misconduct'
                          ? 'bg-red-500/10 text-red-400 border-red-500/30'
                          : 'bg-green-500/10 text-green-400 border-green-500/30'}`}>
                        {e.type === 'misconduct' ? 'Fehlverhalten' : 'Kein Fehlverhalten'}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm">{e.text}</p>
                    <p className="text-gray-500 text-xs mt-2">
                      von {(e.creator as any)?.username} · {new Date(e.created_at).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {myRole && can.deleteEntries(myRole) && (
                    <button onClick={() => deleteEntry(e.id)}
                      className="text-gray-500 hover:text-red-400 transition flex-shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}