'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { isStaff } from '@/lib/permissions';

interface Todo {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  due_date: string | null;
  completed: boolean;
  user_id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  created_at: string;
  profiles?: { username: string };
  assigned_profile?: { username: string };
}

interface Profile {
  id: string;
  username: string;
  role: UserRole;
}

const PRIORITY_STYLES = {
  high:   'text-red-400 bg-red-500/10 border-red-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low:    'text-green-400 bg-green-500/10 border-green-500/30',
};
const PRIORITY_LABELS = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };

export default function TodosPage() {
  const [todos, setTodos]             = useState<Todo[]>([]);
  const [myRole, setMyRole]           = useState<UserRole | null>(null);
  const [myId, setMyId]               = useState<string>('');
  const [members, setMembers]         = useState<Profile[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [activeTab, setActiveTab]     = useState<'mine' | 'assigned' | 'all'>('mine');
  const [newTodo, setNewTodo]         = useState({
    title: '', description: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    due_date: '', assigned_to: '',
  });
  const supabase = createClientSupabaseClient();

  async function loadTodos() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile) setMyRole(profile.role as UserRole);

    const { data } = await supabase
      .from('todos')
      .select(`*, profiles!todos_user_id_fkey(username), assigned_profile:profiles!todos_assigned_to_fkey(username)`)
      .order('completed')
      .order('created_at', { ascending: false });
    setTodos(data || []);

    if (profile && isStaff(profile.role as UserRole)) {
      const { data: allMembers } = await supabase.from('profiles').select('id, username, role').eq('is_active', true).order('username');
      setMembers(allMembers || []);
    }
    setLoading(false);
  }

  useEffect(() => { loadTodos(); }, []);

  async function addTodo() {
    if (!newTodo.title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('todos').insert({
      title: newTodo.title, description: newTodo.description || null,
      priority: newTodo.priority, due_date: newTodo.due_date || null,
      user_id: user!.id, assigned_to: newTodo.assigned_to || null,
      assigned_by: newTodo.assigned_to ? user!.id : null,
    });
    setNewTodo({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' });
    setShowForm(false);
    loadTodos();
  }

  async function toggleTodo(id: string, completed: boolean) {
    await supabase.from('todos').update({ completed: !completed }).eq('id', id);
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
    if (selectedTodo?.id === id) setSelectedTodo(prev => prev ? { ...prev, completed: !completed } : null);
  }

  async function deleteTodo(id: string) {
    await supabase.from('todos').delete().eq('id', id);
    setTodos(prev => prev.filter(t => t.id !== id));
    setSelectedTodo(null);
  }

  const canAssign = myRole ? isStaff(myRole) : false;
  const canSeeAll = myRole ? isStaff(myRole) : false;
  const canDelete = myRole ? isStaff(myRole) : false;

  const myTodos       = todos.filter(t => t.user_id === myId && !t.assigned_to);
  const assignedTodos = todos.filter(t => t.assigned_to === myId);
  const allTodos      = todos;

  const displayTodos = activeTab === 'mine' ? myTodos : activeTab === 'assigned' ? assignedTodos : allTodos;
  const open      = displayTodos.filter(t => !t.completed);
  const completed = displayTodos.filter(t => t.completed);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Todo-Listen</h1>
          <p className="text-gray-400 text-sm mt-1">{open.length} offen · {completed.length} erledigt</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Todo hinzufügen
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'mine',     label: `Meine Todos (${myTodos.length})`,       show: true },
          { key: 'assigned', label: `Mir zugewiesen (${assignedTodos.length})`, show: true },
          { key: 'all',      label: `Alle (${allTodos.length})`,              show: canSeeAll },
        ].filter(t => t.show).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.key ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Formular */}
      {showForm && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-medium">Neues Todo</h3>
          <input value={newTodo.title} onChange={e => setNewTodo(p => ({ ...p, title: e.target.value }))}
            placeholder="Todo Titel..."
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
          <textarea value={newTodo.description} onChange={e => setNewTodo(p => ({ ...p, description: e.target.value }))}
            placeholder="Beschreibung (optional)..." rows={3}
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Priorität</label>
              <select value={newTodo.priority} onChange={e => setNewTodo(p => ({ ...p, priority: e.target.value as any }))}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Fälligkeitsdatum</label>
              <input type="date" value={newTodo.due_date} onChange={e => setNewTodo(p => ({ ...p, due_date: e.target.value }))}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          {canAssign && members.length > 0 && (
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Aufgabe zuweisen (optional)</label>
              <select value={newTodo.assigned_to} onChange={e => setNewTodo(p => ({ ...p, assigned_to: e.target.value }))}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="">Niemanden zuweisen</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="bg-white/5 hover:bg-white/10 text-gray-300 font-medium px-4 py-2 rounded-lg transition text-sm">Abbrechen</button>
            <button onClick={addTodo} disabled={!newTodo.title.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg transition text-sm">
              Hinzufügen
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="space-y-2">
        {open.map(todo => {
          const isAssigned = todo.assigned_to && todo.assigned_to !== todo.user_id;
          return (
            <div key={todo.id} onClick={() => setSelectedTodo(todo)}
              className="bg-[#1a1d27] border border-white/10 rounded-xl px-5 py-4 flex items-center gap-4 group hover:border-white/20 cursor-pointer transition">
              <button onClick={e => { e.stopPropagation(); toggleTodo(todo.id, todo.completed); }}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${todo.completed ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-blue-400'}`}>
                {todo.completed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`text-sm font-medium ${todo.completed ? 'line-through text-gray-500' : 'text-white'}`}>{todo.title}</p>
                  {isAssigned && <span className="text-xs px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/30">📌 Zugewiesen</span>}
                </div>
                {todo.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{todo.description}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {todo.due_date && <span className="text-xs text-gray-400">{new Date(todo.due_date).toLocaleDateString('de-DE')}</span>}
                <span className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_STYLES[todo.priority]}`}>{PRIORITY_LABELS[todo.priority]}</span>
              </div>
            </div>
          );
        })}
        {open.length === 0 && <div className="text-center py-8 text-gray-500 text-sm">Keine offenen Todos 🎉</div>}
      </div>

      {completed.length > 0 && (
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Erledigt</h3>
          <div className="space-y-2 opacity-60">
            {completed.map(todo => (
              <div key={todo.id} onClick={() => setSelectedTodo(todo)}
                className="bg-[#1a1d27] border border-white/10 rounded-xl px-5 py-4 flex items-center gap-4 group hover:border-white/20 cursor-pointer transition">
                <button onClick={e => { e.stopPropagation(); toggleTodo(todo.id, todo.completed); }}
                  className="w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition bg-green-500 border-green-500">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-through text-gray-500">{todo.title}</p>
                  {todo.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{todo.description}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_STYLES[todo.priority]}`}>{PRIORITY_LABELS[todo.priority]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TODO DETAIL MODAL */}
      {selectedTodo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-lg">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={e => { e.stopPropagation(); toggleTodo(selectedTodo.id, selectedTodo.completed); }}
                  className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${selectedTodo.completed ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-blue-400'}`}>
                  {selectedTodo.completed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <h2 className={`text-white font-bold ${selectedTodo.completed ? 'line-through text-gray-400' : ''}`}>{selectedTodo.title}</h2>
              </div>
              <button onClick={() => setSelectedTodo(null)} className="text-gray-400 hover:text-white transition text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Priorität</p>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${PRIORITY_STYLES[selectedTodo.priority]}`}>{PRIORITY_LABELS[selectedTodo.priority]}</span>
                </div>
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Status</p>
                  <span className={`text-xs font-medium ${selectedTodo.completed ? 'text-green-400' : 'text-yellow-400'}`}>{selectedTodo.completed ? '✅ Erledigt' : '⏳ Offen'}</span>
                </div>
                {selectedTodo.due_date && (
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Fällig am</p>
                    <p className="text-white text-sm">{new Date(selectedTodo.due_date).toLocaleDateString('de-DE')}</p>
                  </div>
                )}
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Erstellt am</p>
                  <p className="text-white text-sm">{new Date(selectedTodo.created_at).toLocaleDateString('de-DE')}</p>
                </div>
              </div>

              {selectedTodo.profiles && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Erstellt von</p>
                  <p className="text-purple-400 text-sm font-medium">{selectedTodo.profiles.username}</p>
                </div>
              )}

              {selectedTodo.assigned_profile && (
                <div className="bg-[#0f1117] rounded-lg p-3">
                  <p className="text-gray-500 text-xs mb-1">Zugewiesen an</p>
                  <p className="text-blue-400 text-sm font-medium">{selectedTodo.assigned_profile.username}</p>
                </div>
              )}

              {selectedTodo.description && (
                <div className="bg-[#0f1117] rounded-lg p-4">
                  <p className="text-gray-500 text-xs mb-2">Beschreibung</p>
                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{selectedTodo.description}</p>
                </div>
              )}

              {(canDelete || selectedTodo.user_id === myId) && (
                <button onClick={() => deleteTodo(selectedTodo.id)}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium py-2.5 rounded-lg text-sm transition">
                  🗑️ Todo löschen
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}