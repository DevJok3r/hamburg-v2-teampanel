'use client';

import { useEffect, useState } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can, ROLE_LABELS } from '@/lib/permissions';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

interface Application {
  id: string;
  user_id: string;
  department: string;
  status: ApplicationStatus;
  answers: Record<string, any>;
  reviewed_by?: string;
  review_note?: string;
  created_at: string;
  applicant?: { username: string; role: UserRole };
  reviewer?: { username: string };
}

const STATUS_STYLE: Record<ApplicationStatus, string> = {
  pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  approved: 'bg-green-500/10 text-green-400 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
};
const STATUS_LABEL: Record<ApplicationStatus, string> = {
  pending: '⏳ Ausstehend', approved: '✅ Angenommen', rejected: '❌ Abgelehnt',
};

export default function ApplicationsPage() {
  const supabase = createClientSupabaseClient();
  const [myId, setMyId]       = useState('');
  const [myRole, setMyRole]   = useState<UserRole | null>(null);
  const [apps, setApps]       = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Application | null>(null);
  const [note, setNote]         = useState('');
  const [saving, setSaving]     = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | ApplicationStatus>('all');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (p) setMyRole(p.role as UserRole);
    const { data } = await supabase.from('department_applications')
      .select('*, applicant:user_id(username, role), reviewer:reviewed_by(username)')
      .order('created_at', { ascending: false });
    setApps(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function review(id: string, status: ApplicationStatus) {
    setSaving(true);
    await supabase.from('department_applications').update({ status, reviewed_by: myId, review_note: note || null }).eq('id', id);
    setSelected(null); setNote('');
    await load();
    setSaving(false);
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;
  if (!myRole || !can.isSenior(myRole)) return <div className="text-center py-12 text-gray-400">Kein Zugriff.</div>;

  const canReview = can.isManagement(myRole);
  const filtered  = apps.filter(a => filterStatus === 'all' || a.status === filterStatus);

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#13151f] border border-white/[0.08] rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">Bewerbung – {selected.applicant?.username}</h2>
                <p className="text-gray-500 text-sm">{selected.department} · {new Date(selected.created_at).toLocaleDateString('de-DE')}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white text-xl">×</button>
            </div>
            <div className="space-y-3">
              {Object.entries(selected.answers || {}).map(([key, value]) => (
                <div key={key} className="bg-[#0d0e14] rounded-xl p-4">
                  <p className="text-gray-500 text-xs mb-1 capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-white text-sm">{String(value)}</p>
                </div>
              ))}
            </div>
            {canReview && selected.status === 'pending' && (
              <div className="border-t border-white/[0.05] pt-4 space-y-3">
                <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notiz (optional)..." rows={2}
                  className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/70 resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => review(selected.id, 'approved')} disabled={saving}
                    className="flex-1 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 py-2.5 rounded-xl text-sm font-medium transition">
                    ✅ Annehmen
                  </button>
                  <button onClick={() => review(selected.id, 'rejected')} disabled={saving}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 py-2.5 rounded-xl text-sm font-medium transition">
                    ❌ Ablehnen
                  </button>
                </div>
              </div>
            )}
            {selected.review_note && (
              <div className="bg-white/[0.03] rounded-xl p-4">
                <p className="text-gray-500 text-xs mb-1">Notiz</p>
                <p className="text-gray-300 text-sm">{selected.review_note}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">Bewerbungen</h1>
        <p className="text-gray-500 text-sm mt-1">{apps.filter(a => a.status === 'pending').length} offene Bewerbungen</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all','pending','approved','rejected'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${filterStatus === s ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/30 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}>
            {s === 'all' ? `Alle (${apps.length})` : s === 'pending' ? `Ausstehend (${apps.filter(a=>a.status==='pending').length})` : s === 'approved' ? `Angenommen (${apps.filter(a=>a.status==='approved').length})` : `Abgelehnt (${apps.filter(a=>a.status==='rejected').length})`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-[#13151f] border border-white/[0.06] rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">📨</p>
            <p className="text-gray-500 text-sm">Keine Bewerbungen.</p>
          </div>
        ) : filtered.map(a => (
          <div key={a.id} onClick={() => setSelected(a)}
            className="bg-[#13151f] border border-white/[0.06] hover:border-purple-500/20 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 cursor-pointer transition">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {a.applicant?.username?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{a.applicant?.username}</p>
                <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                  <span>{a.department}</span>
                  <span>·</span>
                  <span>{new Date(a.created_at).toLocaleDateString('de-DE')}</span>
                  {a.reviewer && <><span>·</span><span>Bearbeitet: {a.reviewer.username}</span></>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${STATUS_STYLE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
              <span className="text-gray-600 text-xs">→</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}