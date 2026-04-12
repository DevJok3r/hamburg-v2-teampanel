'use client';

import { useEffect, useState } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import type { TeamApplication, UserRole } from '@/types';
import { ROLE_HIERARCHY } from '@/lib/permissions';

type ApplicationStatus = 'pending' | 'approved' | 'rejected';

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  approved: 'bg-green-500/10 text-green-400 border-green-500/30',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/30',
};

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};

function normalizeStatus(status: unknown): ApplicationStatus {
  if (status === 'approved' || status === 'rejected' || status === 'pending') {
    return status;
  }
  return 'pending';
}

export default function ApplicationsPage() {
  const supabase = createClientSupabaseClient();

  const [applications, setApplications] = useState<TeamApplication[]>([]);
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [myId, setMyId] = useState('');
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<TeamApplication | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const [form, setForm] = useState({
    partner_name: '',
    reason: '',
    experience: '',
    availability: '',
  });

  async function load() {
    setLoading(true);

    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) return;

    setMyId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role as UserRole | undefined;
    if (role) setMyRole(role);

    const { data } = await supabase
      .from('team_applications')
      .select('*, profiles!team_applications_applicant_id_fkey(username, role)')
      .order('created_at', { ascending: false });

    setApplications((data ?? []) as TeamApplication[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const roleLevel = myRole ? ROLE_HIERARCHY[myRole] : 0;
  const isManagement = roleLevel >= ROLE_HIERARCHY.teamleitung;
  const isTopManagement = roleLevel >= ROLE_HIERARCHY.projektleitung;

  async function submitApplication() {
    if (!myId) return;

    const { partner_name, reason, experience, availability } = form;

    if (!partner_name || !reason || !experience || !availability) return;

    await supabase.from('team_applications').insert({
      applicant_id: myId,
      ...form,
      status: 'pending',
    });

    setForm({
      partner_name: '',
      reason: '',
      experience: '',
      availability: '',
    });

    setShowForm(false);
    load();
  }

  async function reviewApplication(status: 'approved' | 'rejected') {
    if (!reviewTarget) return;

    await supabase
      .from('team_applications')
      .update({
        status,
        reviewed_by: myId,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote || null,
      })
      .eq('id', reviewTarget.id);

    setReviewTarget(null);
    setReviewNote('');
    load();
  }

  async function deleteApplication(id: string) {
    await supabase.from('team_applications').delete().eq('id', id);
    load();
  }

  if (loading) {
    return <div className="text-gray-400 text-center py-12">Lade...</div>;
  }

  if (!isManagement && !isTopManagement) {
    return (
      <div className="text-center py-12 text-gray-400">
        Kein Zugriff auf diese Seite.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Team Partner Anträge</h1>
          <p className="text-gray-400 text-sm mt-1">
            {isTopManagement ? 'Alle Anträge' : 'Deine Anträge'}
          </p>
        </div>

        {isManagement && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Antrag stellen
          </button>
        )}
      </div>

      {/* FORM */}
      {showForm && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-3">
          {Object.entries(form).map(([key, value]) => (
            <input
              key={key}
              value={value}
              onChange={e =>
                setForm(p => ({ ...p, [key]: e.target.value }))
              }
              placeholder={key}
              className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2 text-white text-sm"
            />
          ))}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400"
            >
              Abbrechen
            </button>

            <button
              onClick={submitApplication}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Senden
            </button>
          </div>
        </div>
      )}

      {/* LIST */}
      <div className="space-y-3">
        {applications.map(app => {
          const status = normalizeStatus(app.status);

          return (
            <div
              key={app.id}
              className="bg-[#1a1d27] border border-white/10 rounded-xl p-5"
            >
              <div className="flex justify-between">
                <div>
                  <div className="flex gap-2 items-center mb-2 flex-wrap">
                    {isTopManagement && (
                      <span className="text-white text-sm font-medium">
                        {(app.profiles as any)?.username}
                      </span>
                    )}

                    <span className="text-blue-400 font-medium text-sm">
                      {app.partner_name}
                    </span>

                    <span className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLES[status]}`}>
                      {STATUS_LABELS[status]}
                    </span>
                  </div>

                  <p className="text-gray-300 text-sm">{app.reason}</p>
                </div>

                <div className="flex gap-2">
                  {isTopManagement && status === 'pending' && (
                    <button
                      onClick={() => setReviewTarget(app)}
                      className="text-blue-400 text-xs"
                    >
                      Prüfen
                    </button>
                  )}

                  <button
                    onClick={() => deleteApplication(app.id)}
                    className="text-red-400 text-xs"
                  >
                    Löschen
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL */}
      {reviewTarget && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center">
          <div className="bg-[#1a1d27] p-6 rounded-xl w-full max-w-md space-y-3">

            <textarea
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              placeholder="Notiz"
              className="w-full bg-[#0f1117] p-2 text-white rounded"
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setReviewTarget(null)}>
                Abbruch
              </button>

              <button
                onClick={() => reviewApplication('rejected')}
                className="text-red-400"
              >
                Ablehnen
              </button>

              <button
                onClick={() => reviewApplication('approved')}
                className="text-green-400"
              >
                Genehmigen
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}