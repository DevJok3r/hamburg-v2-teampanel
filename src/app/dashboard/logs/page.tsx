'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';

type LogCategory = 'auth' | 'entries' | 'warnings' | 'absences' | 'conferences' | 'users' | 'roles' | 'applications' | 'system';

interface SystemLog {
  id: string;
  category: LogCategory;
  action: string;
  actor_id: string | null;
  target_id: string | null;
  details: Record<string, any>;
  created_at: string;
  actor?: { username: string; role: UserRole };
  target?: { username: string; role: UserRole };
}

const CATEGORY_STYLES: Record<LogCategory, string> = {
  auth:         'bg-blue-500/10 text-blue-400 border-blue-500/30',
  entries:      'bg-purple-500/10 text-purple-400 border-purple-500/30',
  warnings:     'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  absences:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  conferences:  'bg-green-500/10 text-green-400 border-green-500/30',
  users:        'bg-red-500/10 text-red-400 border-red-500/30',
  roles:        'bg-pink-500/10 text-pink-400 border-pink-500/30',
  applications: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
  system:       'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

const CATEGORY_LABELS: Record<LogCategory, string> = {
  auth:         'Login',
  entries:      'Einträge',
  warnings:     'Verwarnungen',
  absences:     'Abmeldungen',
  conferences:  'Konferenzen',
  users:        'Benutzer',
  roles:        'Rollen',
  applications: 'Anträge',
  system:       'System',
};

const ACTION_LABELS: Record<string, string> = {
  login:                  'Eingeloggt',
  entry_created:          'Eintrag erstellt',
  entry_deleted:          'Eintrag gelöscht',
  warning_issued:         'Verwarnung ausgestellt',
  warning_deleted:        'Verwarnung gelöscht',
  absence_created:        'Abmeldung erstellt',
  absence_reviewed:       'Abmeldung bearbeitet',
  absence_deleted:        'Abmeldung gelöscht',
  conference_created:     'Konferenz erstellt',
  conference_started:     'Konferenz gestartet',
  conference_ended:       'Konferenz beendet',
  conference_cancelled:   'Konferenz abgesagt',
  conference_updated:     'Konferenz bearbeitet',
  conference_deleted:     'Konferenz gelöscht',
  user_created:           'Benutzer erstellt',
  member_kicked:          'Mitglied rausgeworfen',
  role_changed:           'Rolle geändert',
  application_submitted:  'Antrag gestellt',
  application_reviewed:   'Antrag bearbeitet',
  application_deleted:    'Antrag gelöscht',
};

const ALL_CATEGORIES: LogCategory[] = ['auth', 'entries', 'warnings', 'absences', 'conferences', 'users', 'roles', 'applications', 'system'];

export default function LogsPage() {
  const [logs, setLogs]           = useState<SystemLog[]>([]);
  const [myRole, setMyRole]       = useState<UserRole | null>(null);
  const [myUsername, setMyUsername] = useState<string>('');
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState<LogCategory | 'all'>('all');
  const [page, setPage]           = useState(0);
  const PAGE_SIZE = 50;

  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles').select('role, username').eq('id', user.id).single();
    if (profile) {
      setMyRole(profile.role as UserRole);
      setMyUsername(profile.username);
    }

    await fetchLogs('all', 0);
    setLoading(false);
  }

  async function fetchLogs(tab: LogCategory | 'all', pageNum: number) {
    let query = supabase
      .from('system_logs')
      .select('*, actor:actor_id(username, role), target:target_id(username, role)')
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (tab !== 'all') {
      query = query.eq('category', tab);
    }

    const { data } = await query;
    setLogs(data || []);
  }

  useEffect(() => { load(); }, []);

  async function changeTab(tab: LogCategory | 'all') {
    setActiveTab(tab);
    setPage(0);
    await fetchLogs(tab, 0);
  }

  async function changePage(newPage: number) {
    setPage(newPage);
    await fetchLogs(activeTab, newPage);
  }

  async function deleteLog(id: string) {
    await supabase.from('system_logs').delete().eq('id', id);
    fetchLogs(activeTab, page);
  }

  function formatDetails(log: SystemLog): string {
    const d = log.details;
    if (!d) return '';
    switch (log.action) {
      case 'role_changed':    return `${d.old_role} → ${d.new_role}`;
      case 'entry_created':   return `[${d.type}] ${d.text?.substring(0, 50)}${d.text?.length > 50 ? '...' : ''}`;
      case 'entry_deleted':   return `[${d.type}] ${d.text?.substring(0, 50)}${d.text?.length > 50 ? '...' : ''}`;
      case 'warning_issued':  return d.reason?.substring(0, 60);
      case 'absence_created': return `${d.from} – ${d.to}`;
      case 'absence_reviewed':return `Status: ${d.status}`;
      case 'application_reviewed': return `Status: ${d.status} – Partner: ${d.partner}`;
      default: return Object.values(d).join(' · ');
    }
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  if (!myRole || !['top_management', 'management', 'junior_management'].includes(myRole)) {
    return <div className="text-center py-12 text-gray-400">Kein Zugriff.</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">System Logs</h1>
        <p className="text-gray-400 text-sm mt-1">{logs.length} Einträge geladen</p>
      </div>

      {/* Kategorie Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => changeTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition
            ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          Alle
        </button>
        {ALL_CATEGORIES.map(cat => (
          <button key={cat}
            onClick={() => changeTab(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition
              ${activeTab === cat ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Logs Liste */}
      <div className="space-y-2">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Keine Logs vorhanden</div>
        ) : (
          logs.map(log => (
            <div key={log.id} className="bg-[#1a1d27] border border-white/10 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className={`text-xs px-2 py-1 rounded border flex-shrink-0 mt-0.5 ${CATEGORY_STYLES[log.category]}`}>
                    {CATEGORY_LABELS[log.category]}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-medium">
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      {log.actor && (
                        <span className="text-blue-400 text-xs">von {log.actor.username}</span>
                      )}
                      {log.target && log.target.username !== log.actor?.username && (
                        <span className="text-gray-400 text-xs">→ {log.target.username}</span>
                      )}
                    </div>
                    {formatDetails(log) && (
                      <p className="text-gray-500 text-xs mt-0.5 truncate">{formatDetails(log)}</p>
                    )}
                    <p className="text-gray-600 text-xs mt-1">
                      {new Date(log.created_at).toLocaleString('de-DE', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                {myUsername === 'jxkerlds' && (
                  <button onClick={() => deleteLog(log.id)}
                    className="text-gray-600 hover:text-red-400 transition flex-shrink-0">
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => changePage(page - 1)}
          disabled={page === 0}
          className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed
                     text-gray-300 px-4 py-2 rounded-lg text-sm transition">
          ← Vorherige
        </button>
        <span className="text-gray-400 text-sm">Seite {page + 1}</span>
        <button
          onClick={() => changePage(page + 1)}
          disabled={logs.length < PAGE_SIZE}
          className="bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed
                     text-gray-300 px-4 py-2 rounded-lg text-sm transition">
          Nächste →
        </button>
      </div>
    </div>
  );
}