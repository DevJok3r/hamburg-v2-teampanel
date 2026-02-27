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

function TodoItem({ todo, onToggle, onDelete, canDelete, myId }: {
  todo: Todo;
  onToggle: (id: string, c: boolean) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
  myId: string;
}) {
  const isAssigned = todo.assigned_to && todo.assigned_to !== todo.user_id;
  return (
    <div className="bg-[#1a1d27] border border-white/10 rounded-xl px-5 py-4 flex items-center gap-4 group hover:border-white/20 transition">
      <button onClick={() => onToggle(todo.id, todo.completed)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition
          ${todo.completed ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-blue-400'}`}>
        {todo.completed && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-sm font-medium ${todo.completed ? 'line-through text-gray-500' : 'text-white'}`}>
            {todo.title}
          </p>
          {isAssigned && (
            <span className="text-xs px-2 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/30">
              📌 Zugewiesen
            </span>
          )}
        </div>
        {todo.description && <p className="text-xs text-gray-400 mt-0.5 truncate">{todo.description}</p>}
        {isAssigned && todo.assigned_profile && (
          <p className="text-xs text-gray-500 mt-0.5">
            Für: <span className="text-gray-400">{todo.assigned_profile.username}</span>
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {todo.due_date && (
          <span className="text-xs text-gray-400">{new Date(todo.due_date).toLocaleDateString('de-DE')}</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_STYLES[todo.priority]}`}>
          {PRIORITY_LABELS[todo.priority]}
        </span>
        {(canDelete || todo.user_id === myId) && (
          <button onClick={() => onDelete(todo.id)}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition ml-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function TodosPage() {
  const [todos, setTodos]         = useState<Todo[]>([]);
  const [myRole, setMyRole]       = useState<UserRole | null>(null);
  const [myId, setMyId]           = useState<string>('');
  const [members, setMembers]     = useState<Profile[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [activeTab, setActiveTab] = useState<'mine' | 'assigned' | 'all'>('mine');
  const [newTodo, setNewTodo]     = useState({
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
      .select(`
        *,
        profiles!todos_user_id_fkey(username),
        assigned_profile:profiles!todos_assigned_to_fkey(username)
      `)
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
      title:       newTodo.title,
      description: newTodo.description || null,
      priority:    newTodo.priority,
      due_date:    newTodo.due_date || null,
      user_id:     user!.id,
      assigned_to: newTodo.assigned_to || null,
      assigned_by: newTodo.assigned_to ? user!.id : null,
    });
    setNewTodo({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '' });
    setShowForm(false);
    loadTodos();
  }

  async function toggleTodo(id: string, completed: boolean) {
    await supabase.from('todos').update({ completed: !completed }).eq('id', id);
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !completed } : t));
  }

  async function deleteTodo(id: string) {
    await supabase.from('todos').delete().eq('id', id);
    setTodos(prev => prev.filter(t => t.id !== id));
  }

  const canAssign  = myRole ? isStaff(myRole) : false;
  const canSeeAll  = myRole ? isStaff(myRole) : false;
  const canDelete  = myRole ? isStaff(myRole) : false;

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
        <button onClick={() => setActiveTab('mine')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'mine' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          Meine Todos ({myTodos.length})
        </button>
        <button onClick={() => setActiveTab('assigned')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'assigned' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          Mir zugewiesen ({assignedTodos.length})
        </button>
        {canSeeAll && (
          <button onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            Alle ({allTodos.length})
          </button>
        )}
      </div>

      {/* Formular */}
      {showForm && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
          <h3 className="text-white font-medium">Neues Todo</h3>
          <input value={newTodo.title} onChange={e => setNewTodo(p => ({ ...p, title: e.target.value }))}
            placeholder="Todo Titel..."
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm" />
          <textarea value={newTodo.description} onChange={e => setNewTodo(p => ({ ...p, description: e.target.value }))}
            placeholder="Beschreibung (optional)..." rows={2}
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
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.username}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)}
              className="bg-white/5 hover:bg-white/10 text-gray-300 font-medium px-4 py-2 rounded-lg transition text-sm">
              Abbrechen
            </button>
            <button onClick={addTodo} disabled={!newTodo.title.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg transition text-sm">
              Hinzufügen
            </button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="space-y-2">
        {open.map(todo => (
          <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} canDelete={canDelete} myId={myId} />
        ))}
        {open.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">Keine offenen Todos 🎉</div>
        )}
      </div>

      {completed.length > 0 && (
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Erledigt</h3>
          <div className="space-y-2 opacity-60">
            {completed.map(todo => (
              <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} canDelete={canDelete} myId={myId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}