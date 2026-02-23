'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { TeamApplication, UserRole } from '@/types';
import RoleBadge from '@/components/RoleBadge';

const STATUS_STYLES = {
  pending:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const STATUS_LABELS = {
  pending:  'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [myRole, setMyRole]             = useState<UserRole | null>(null);
  const [myId, setMyId]                 = useState<string>('');
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [reviewModal, setReviewModal]   = useState<TeamApplication | null>(null);
  const [reviewNote, setReviewNote]     = useState('');
  const [form, setForm]                 = useState({
    partner_name: '',
    reason: '',
    experience: '',
    availability: '',
  });

  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();

    if (profile) setMyRole(profile.role as UserRole);

    const { data } = await supabase
      .from('team_applications')
      .select('*, profiles!team_applications_applicant_id_fkey(username, role)')
      .order('created_at', { ascending: false });

    setApplications(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function submitApplication() {
    if (!form.partner_name.trim() || !form.reason.trim() || !form.experience.trim() || !form.availability.trim()) return;
    await supabase.from('team_applications').insert({
      applicant_id: myId,
      ...form,
    });
    setForm({ partner_name: '', reason: '', experience: '', availability: '' });
    setShowForm(false);
    load();
  }

  async function reviewApplication(id: string, status: 'approved' | 'rejected') {
    await supabase.from('team_applications').update({
      status,
      reviewed_by: myId,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote || null,
    }).eq('id', id);
    setReviewModal(null);
    setReviewNote('');
    load();
  }

  async function deleteApplication(id: string) {
    await supabase.from('team_applications').delete().eq('id', id);
    load();
  }

  const isTopManagement = myRole === 'top_management';
  const isManagement    = myRole === 'management';

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  if (!isTopManagement && !isManagement) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Kein Zugriff auf diese Seite.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Team Partner Anträge</h1>
          <p className="text-gray-400 text-sm mt-1">
            {isTopManagement ? 'Alle Anträge' : 'Deine Anträge'}
          </p>
        </div>
        {isManagement && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg
                       transition text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Antrag stellen
          </button>
        )}
      </div>

      {/* Antrag Formular */}
      {showForm && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-medium">Neuer Team Partner Antrag</h3>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Gewünschter Team Partner</label>
            <input
              value={form.partner_name}
              onChange={e => setForm(p => ({ ...p, partner_name: e.target.value }))}
              placeholder="Name des gewünschten Partners..."
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                         text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Begründung</label>
            <textarea
              value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Warum möchtest du mit dieser Person zusammenarbeiten?"
              rows={3}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                         text-white placeholder-gray-500 text-sm focus:outline-none
                         focus:border-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Erfahrung des Partners</label>
            <textarea
              value={form.experience}
              onChange={e => setForm(p => ({ ...p, experience: e.target.value }))}
              placeholder="Welche Erfahrung bringt der Partner mit?"
              rows={2}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                         text-white placeholder-gray-500 text-sm focus:outline-none
                         focus:border-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs mb-1 block">Verfügbarkeit des Partners</label>
            <input
              value={form.availability}
              onChange={e => setForm(p => ({ ...p, availability: e.target.value }))}
              placeholder="z.B. täglich 3-4 Stunden, Wochenende..."
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                         text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)}
              className="bg-white/5 hover:bg-white/10 text-gray-300 font-medium px-4 py-2 rounded-lg transition text-sm">
              Abbrechen
            </button>
            <button onClick={submitApplication}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg transition text-sm">
              Antrag stellen
            </button>
          </div>
        </div>
      )}

      {/* Review Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white font-bold text-lg mb-2">Antrag prüfen</h2>
            <p className="text-gray-400 text-sm mb-4">
              Antrag von <span className="text-blue-400 font-medium">{(reviewModal.profiles as any)?.username}</span>
            </p>
            <div className="bg-[#0f1117] rounded-lg p-4 space-y-2 mb-4 text-sm">
              <p><span className="text-gray-400">Partner:</span> <span className="text-white">{reviewModal.partner_name}</span></p>
              <p><span className="text-gray-400">Begründung:</span> <span className="text-white">{reviewModal.reason}</span></p>
              <p><span className="text-gray-400">Erfahrung:</span> <span className="text-white">{reviewModal.experience}</span></p>
              <p><span className="text-gray-400">Verfügbarkeit:</span> <span className="text-white">{reviewModal.availability}</span></p>
            </div>
            <textarea
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              placeholder="Anmerkung (optional)..."
              rows={2}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                         text-white placeholder-gray-500 text-sm focus:outline-none
                         focus:border-blue-500 resize-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setReviewModal(null); setReviewNote(''); }}
                className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm transition">
                Abbrechen
              </button>
              <button onClick={() => reviewApplication(reviewModal.id, 'rejected')}
                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30
                           px-4 py-2 rounded-lg text-sm transition">
                Ablehnen
              </button>
              <button onClick={() => reviewApplication(reviewModal.id, 'approved')}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition">
                Genehmigen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anträge Liste */}
      <div className="space-y-3">
        {applications.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">Keine Anträge vorhanden</div>
        ) : (
          applications.map(app => (
            <div key={app.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {isTopManagement && (
                      <>
                        <span className="text-white font-medium text-sm">
                          {(app.profiles as any)?.username}
                        </span>
                        <RoleBadge role={(app.profiles as any)?.role as UserRole} size="xs" />
                        <span className="text-gray-500 text-xs">→</span>
                      </>
                    )}
                    <span className="text-blue-400 font-medium text-sm">{app.partner_name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[app.status]}`}>
                      {STATUS_LABELS[app.status]}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm mb-1">{app.reason}</p>
                  <div className="text-xs text-gray-500 space-y-0.5">
                    <p>Erfahrung: {app.experience}</p>
                    <p>Verfügbarkeit: {app.availability}</p>
                    {app.review_note && <p className="text-yellow-400">Anmerkung: {app.review_note}</p>}
                  </div>
                  <p className="text-gray-500 text-xs mt-2">
                    {new Date(app.created_at).toLocaleString('de-DE', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {isTopManagement && app.status === 'pending' && (
                    <button
                      onClick={() => setReviewModal(app)}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border
                                 border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                    >
                      Prüfen
                    </button>
                  )}
                  {(isTopManagement || app.applicant_id === myId) && (
                    <button
                      onClick={() => deleteApplication(app.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border
                                 border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition"
                    >
                      Löschen
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}