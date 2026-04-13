'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can } from '@/lib/permissions';

interface Todo {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  created_by: string;
  assigned_to?: string;
  due_date?: string;
  created_at: string;
  creator?: { username: string };
  assignee?: { username: string };
}

const PRIORITY_STYLE = { low: 'bg-gray-500/10 text-gray-400 border-gray-500/20', medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', high: 'bg-red-500/10 text-red-400 border-red-500/20' };
const PRIORITY_LABEL = { low: '⬇️ Niedrig', medium: '➡️ Mittel', high: '⬆️ Hoch' };
const STATUS_STYLE   = { open: 'bg-blue-500/10 text-blue-400 border-blue-500/20', in_progress: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', done: 'bg-green-500/10 text-green-400 border-green-500/20' };
const STATUS_LABEL   = { open: '📋 Offen', in_progress: '⚙️ In Arbeit', done: '✅ Erledigt' };

export default function TodosPage() {
  const supabase = createClientSupabaseClient();
  const [myId, setMyId]     = useState('');
  const [myRole, setMyRole] = useState<UserRole | null>(null);
  const [todos, setTodos]   = useState<Todo[]>([]);
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm]       = useState({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '' });
  const [saving, setSaving]   = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all'|'open'|'in_progress'|'done'>('all');

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (p) setMyRole(p.role as UserRole);
    const { data: t } = await supabase.from('todos').select('*, creator:created_by(username), assignee:assigned_to(username)').order('created_at', { ascending: false });
    const { data: u } = await supabase.from('profiles').select('id, username').eq('is_active', true).order('username');
    setTodos(t || []);
    setUsers(u || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createTodo() {
    if (!form.title.trim()) return;
    setSaving(true);
    await supabase.from('todos').insert({ title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, status: 'open', created_by: myId, assigned_to: form.assigned_to || null, due_date: form.due_date || null });
    setForm({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '' });
    setShowNew(false);
    await load();
    setSaving(false);
  }

  async function updateStatus(id: string, status: Todo['status']) {
    await supabase.from('todos').update({ status }).eq('id', id);
    await load();
  }

  const canManage = myRole ? can.isManagement(myRole) : false;
  const shown = todos
    .filter(t => canManage || t.created_by === myId || t.assigned_to === myId)
    .filter(t => filterStatus === 'all' || t.status === filterStatus);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Aufgaben</h1>
          <p className="text-gray-500 text-sm mt-1">{todos.filter(t=>t.status==='open').length} offene Tasks</p>
        </div>
        <button onClick={() => setShowNew(v => !v)}
          className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition">
          + Neue Aufgabe
        </button>
      </div>

      {showNew && (
        <div className="bg-[#13151f] border border-purple-500/20 rounded-2xl p-6 space-y-4">
          <h2 className="text-white font-semibold">Aufgabe erstellen</h2>
          <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Titel *"
            className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/70" />
          <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} placeholder="Beschreibung (optional)" rows={3}
            className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-purple-500/70 resize-none" />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.priority} onChange={e => setForm(p => ({...p, priority: e.target.value}))}
              className="bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/70">
              <option value="low">Niedrig</option>
              <option value="medium">Mittel</option>
              <option value="high">Hoch</option>
            </select>
            <select value={form.assigned_to} onChange={e => setForm(p => ({...p, assigned_to: e.target.value}))}
              className="bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/70">
              <option value="">Zuweisung (optional)</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
            </select>
            <input type="date" value={form.due_date} onChange={e => setForm(p => ({...p, due_date: e.target.value}))}
              className="bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-purple-500/70" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(false)} className="bg-white/5 hover:bg-white/10 text-gray-400 px-4 py-2 rounded-xl text-sm transition">Abbrechen</button>
            <button onClick={createTodo} disabled={saving || !form.title.trim()} className="bg-gradient-to-r from-pink-600 to-purple-600 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-xl text-sm transition">
              {saving ? 'Erstellen...' : 'Erstellen'}
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {(['all','open','in_progress','done'] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${filterStatus===s ? 'bg-gradient-to-r from-pink-600/30 to-purple-600/30 text-purple-300 border border-purple-500/30' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}>
            {s==='all'?'Alle':s==='open'?'Offen':s==='in_progress'?'In Arbeit':'Erledigt'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.length === 0 ? (
          <div className="bg-[#13151f] border border-white/[0.06] rounded-2xl p-12 text-center">
            <p className="text-4xl mb-3">✅</p>
            <p className="text-gray-500 text-sm">Keine Aufgaben gefunden.</p>
          </div>
        ) : shown.map(t => (
          <div key={t.id} className="bg-[#13151f] border border-white/[0.06] hover:border-white/10 rounded-2xl p-5 transition">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h3 className="text-white font-medium">{t.title}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${PRIORITY_STYLE[t.priority]}`}>{PRIORITY_LABEL[t.priority]}</span>
                </div>
                {t.description && <p className="text-gray-500 text-sm mb-2">{t.description}</p>}
                <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                  {t.creator && <span>👤 {t.creator.username}</span>}
                  {t.assignee && <span>→ {t.assignee.username}</span>}
                  {t.due_date && <span>📅 {new Date(t.due_date).toLocaleDateString('de-DE')}</span>}
                </div>
              </div>
              {(t.created_by === myId || canManage) && t.status !== 'done' && (
                <select value={t.status} onChange={e => updateStatus(t.id, e.target.value as Todo['status'])}
                  className="bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-purple-500/50 flex-shrink-0">
                  <option value="open">Offen</option>
                  <option value="in_progress">In Arbeit</option>
                  <option value="done">Erledigt</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
