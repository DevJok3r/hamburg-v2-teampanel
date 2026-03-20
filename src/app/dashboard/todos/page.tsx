'use client';
import { log } from '@/lib/logger';

import { useState, useEffect, useMemo } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';

interface Todo {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'review' | 'done';
  due_date: string | null;
  completed: boolean;
  user_id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  tags: string[];
  color: string;
  created_at: string;
  updated_at: string;
  profiles?: { username: string };
  assigned_profile?: { username: string };
}

interface Profile {
  id: string;
  username: string;
  role: UserRole;
}

const PRIORITY_CONFIG = {
  high:   { label: 'Hoch',    color: 'text-red-400 bg-red-500/10 border-red-500/30',          dot: 'bg-red-400' },
  medium: { label: 'Mittel',  color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', dot: 'bg-yellow-400' },
  low:    { label: 'Niedrig', color: 'text-green-400 bg-green-500/10 border-green-500/30',    dot: 'bg-green-400' },
};

const STATUS_CONFIG = {
  open:        { label: 'Offen',           icon: '○', color: 'text-gray-400 bg-gray-500/10 border-gray-500/30',       next: 'in_progress' },
  in_progress: { label: 'In Bearbeitung',  icon: '◐', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',       next: 'review' },
  review:      { label: 'Zur Überprüfung', icon: '◑', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30', next: 'done' },
  done:        { label: 'Erledigt',        icon: '●', color: 'text-green-400 bg-green-500/10 border-green-500/30',    next: 'open' },
};

const COLORS = [
  { key: 'blue',   label: 'Blau',   bg: 'bg-blue-500',   border: 'border-blue-500/50' },
  { key: 'purple', label: 'Lila',   bg: 'bg-purple-500', border: 'border-purple-500/50' },
  { key: 'green',  label: 'Grün',   bg: 'bg-green-500',  border: 'border-green-500/50' },
  { key: 'red',    label: 'Rot',    bg: 'bg-red-500',    border: 'border-red-500/50' },
  { key: 'orange', label: 'Orange', bg: 'bg-orange-500', border: 'border-orange-500/50' },
  { key: 'pink',   label: 'Pink',   bg: 'bg-pink-500',   border: 'border-pink-500/50' },
  { key: 'cyan',   label: 'Cyan',   bg: 'bg-cyan-500',   border: 'border-cyan-500/50' },
  { key: 'yellow', label: 'Gelb',   bg: 'bg-yellow-500', border: 'border-yellow-500/50' },
];

const COLOR_BORDER: Record<string, string> = {
  blue: 'border-l-blue-500', purple: 'border-l-purple-500', green: 'border-l-green-500',
  red: 'border-l-red-500', orange: 'border-l-orange-500', pink: 'border-l-pink-500',
  cyan: 'border-l-cyan-500', yellow: 'border-l-yellow-500',
};

const PRESET_TAGS = ['Wichtig', 'Dringend', 'Meeting', 'Review', 'Bug', 'Feature', 'Intern', 'Extern', 'Moderation', 'Development', 'Content', 'Event'];

export default function TodosPage() {
  const [todos, setTodos]               = useState<Todo[]>([]);
  const [myRole, setMyRole]             = useState<UserRole | null>(null);
  const [myId, setMyId]                 = useState('');
  const [members, setMembers]           = useState<Profile[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showForm, setShowForm]         = useState(false);
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null);
  const [activeTab, setActiveTab]       = useState<'mine' | 'assigned' | 'all'>('mine');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterTag, setFilterTag]       = useState<string>('all');
  const [search, setSearch]             = useState('');
  const [tagInput, setTagInput]         = useState('');

  const [newTodo, setNewTodo] = useState({
    title: '', description: '',
    priority: 'medium' as 'high' | 'medium' | 'low',
    due_date: '', assigned_to: '',
    tags: [] as string[],
    color: 'blue',
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
      .select('*, profiles!todos_user_id_fkey(username), assigned_profile:profiles!todos_assigned_to_fkey(username)')
      .order('created_at', { ascending: false });
    setTodos(data || []);

    const { data: allMembers } = await supabase.from('profiles').select('id, username, role').eq('is_active', true).order('username');
    setMembers(allMembers || []);
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
      tags: newTodo.tags, color: newTodo.color, status: 'open', completed: false,
    });
    setNewTodo({ title: '', description: '', priority: 'medium', due_date: '', assigned_to: '', tags: [], color: 'blue' });
    setTagInput('');
    setShowForm(false);
    await log('todos', 'todo_created', { title: newTodo.title, priority: newTodo.priority, assigned_to: newTodo.assigned_to || null });
    loadTodos();
  }

  async function cycleStatus(todo: Todo, e: React.MouseEvent) {
    e.stopPropagation();
    const order = ['open', 'in_progress', 'review', 'done'];
    const next  = order[(order.indexOf(todo.status || 'open') + 1) % order.length];
    const completed = next === 'done';
    await supabase.from('todos').update({ status: next, completed, updated_at: new Date().toISOString() }).eq('id', todo.id);
    setTodos(p => p.map(t => t.id === todo.id ? { ...t, status: next as any, completed } : t));
    if (selectedTodo?.id === todo.id) setSelectedTodo(p => p ? { ...p, status: next as any, completed } : null);
  }

  async function deleteTodo(id: string) {
    if (!confirm('Todo wirklich löschen?')) return;
    await supabase.from('todos').delete().eq('id', id);
    setTodos(p => p.filter(t => t.id !== id));
    setSelectedTodo(null);
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t || newTodo.tags.includes(t)) return;
    setNewTodo(p => ({ ...p, tags: [...p.tags, t] }));
    setTagInput('');
  }

  function removeTag(tag: string) {
    setNewTodo(p => ({ ...p, tags: p.tags.filter(t => t !== tag) }));
  }

  // Permissions
  const isTopManagement = myRole === 'top_management';
  const isStaffRole = myRole ? ['junior_management', 'management', 'top_management'].includes(myRole) : false;
  const canAssign = isStaffRole;
  const canDelete = (todo: Todo) => isTopManagement || todo.user_id === myId;

  // Sichtbarkeit:
  // - Top Management sieht ALLES
  // - Alle anderen sehen nur: eigene Todos + ihnen zugewiesene Todos
  const visibleTodos = useMemo(() => {
    if (isTopManagement) return todos;
    return todos.filter(t => t.user_id === myId || t.assigned_to === myId);
  }, [todos, myId, isTopManagement]);

  const myTodos       = visibleTodos.filter(t => t.user_id === myId && !t.assigned_to);
  const assignedTodos = visibleTodos.filter(t => t.assigned_to === myId);

  const displayTodos = activeTab === 'mine'
    ? myTodos
    : activeTab === 'assigned'
    ? assignedTodos
    : visibleTodos; // 'all' tab – nur Top Management sieht diesen Tab

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    visibleTodos.forEach(t => (t.tags || []).forEach(tag => tags.add(tag)));
    return Array.from(tags);
  }, [visibleTodos]);

  const filtered = useMemo(() => displayTodos.filter(t => {
    if (filterStatus !== 'all' && (t.status || 'open') !== filterStatus) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    if (filterTag !== 'all' && !(t.tags || []).includes(filterTag)) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [displayTodos, filterStatus, filterPriority, filterTag, search]);

  const grouped = useMemo(() => ({
    open:        filtered.filter(t => (t.status || 'open') === 'open'),
    in_progress: filtered.filter(t => t.status === 'in_progress'),
    review:      filtered.filter(t => t.status === 'review'),
    done:        filtered.filter(t => t.status === 'done'),
  }), [filtered]);

  const isOverdue = (t: Todo) => t.due_date && !t.completed && new Date(t.due_date) < new Date();

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  const TodoCard = ({ todo }: { todo: Todo }) => {
    const status   = STATUS_CONFIG[todo.status || 'open'];
    const priority = PRIORITY_CONFIG[todo.priority];
    const overdue  = isOverdue(todo);
    const colorBorder = COLOR_BORDER[todo.color || 'blue'] || 'border-l-blue-500';

    return (
      <div onClick={() => setSelectedTodo(todo)}
        className={`bg-[#1a1d27] border border-white/10 border-l-4 ${colorBorder} rounded-xl p-4 cursor-pointer hover:border-white/20 hover:bg-[#1e2130] transition group`}>
        <div className="flex items-start gap-3">
          <button onClick={e => cycleStatus(todo, e)}
            className={`mt-0.5 w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-xs font-bold transition hover:scale-110 ${status.color}`}
            title={`Status: ${status.label}`}>
            {status.icon}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-semibold leading-tight ${todo.completed ? 'line-through text-gray-500' : 'text-white'}`}>
                {todo.title}
              </p>
              <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 ${priority.color}`}>{priority.label}</span>
            </div>
            {todo.description && (
              <p className="text-gray-500 text-xs mt-1 line-clamp-2 leading-relaxed">{todo.description}</p>
            )}
            {(todo.tags || []).length > 0 && (
              <div className="flex gap-1 flex-wrap mt-2">
                {(todo.tags || []).map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">{tag}</span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {todo.profiles && isTopManagement && (
                <span className="text-xs text-gray-500">👤 {todo.profiles.username}</span>
              )}
              {todo.assigned_profile && (
                <span className="text-xs text-gray-500">→ {todo.assigned_profile.username}</span>
              )}
              {todo.due_date && (
                <span className={`text-xs ${overdue ? 'text-red-400 font-medium' : 'text-gray-500'}`}>
                  {overdue ? '⚠️' : '📅'} {new Date(todo.due_date).toLocaleDateString('de-DE')}
                </span>
              )}
              <span className={`text-xs px-1.5 py-0.5 rounded border ${status.color}`}>{status.icon} {status.label}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Todo-Listen</h1>
          <p className="text-gray-400 text-sm mt-1">
            {filtered.filter(t => !t.completed).length} offen ·
            {filtered.filter(t => t.status === 'in_progress').length} in Bearbeitung ·
            {filtered.filter(t => t.completed).length} erledigt
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition flex items-center gap-2 text-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Neues Todo
        </button>
      </div>

      {/* TABS – "Alle" nur für Top Management */}
      <div className="flex gap-1 bg-[#1a1d27] border border-white/10 rounded-xl p-1">
        {[
          { key: 'mine',     label: 'Meine',          count: myTodos.length },
          { key: 'assigned', label: 'Mir zugewiesen', count: assignedTodos.length },
          ...(isTopManagement ? [{ key: 'all', label: 'Alle', count: visibleTodos.length }] : []),
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab === t.key ? 'bg-white/20' : 'bg-white/10 text-gray-500'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* FILTER BAR */}
      <div className="flex gap-2 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Suchen..."
          className="bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500 w-48" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
          <option value="all">Alle Status</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          className="bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
          <option value="all">Alle Prioritäten</option>
          {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {allTags.length > 0 && (
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
            className="bg-[#1a1d27] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
            <option value="all">Alle Tags</option>
            {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
          </select>
        )}
        {(filterStatus !== 'all' || filterPriority !== 'all' || filterTag !== 'all' || search) && (
          <button onClick={() => { setFilterStatus('all'); setFilterPriority('all'); setFilterTag('all'); setSearch(''); }}
            className="text-xs text-gray-400 hover:text-white border border-white/10 rounded-lg px-3 py-2 transition">
            ✕ Filter zurücksetzen
          </button>
        )}
      </div>

      {/* KANBAN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {(Object.entries(grouped) as [string, Todo[]][]).map(([statusKey, items]) => {
          const statusCf = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG];
          return (
            <div key={statusKey} className="bg-[#1a1d27] border border-white/10 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${statusCf.color.split(' ')[0]}`}>{statusCf.icon}</span>
                  <h3 className="text-white text-sm font-semibold">{statusCf.label}</h3>
                </div>
                <span className="text-xs bg-white/10 text-gray-400 px-2 py-0.5 rounded-full font-bold">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.length === 0 && (
                  <div className="text-center py-6 text-gray-600 text-xs">Keine Todos</div>
                )}
                {items.map(todo => <TodoCard key={todo.id} todo={todo} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE MODAL */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-white font-bold text-lg">Neues Todo</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Farbe</label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c.key} onClick={() => setNewTodo(p => ({ ...p, color: c.key }))}
                      className={`w-7 h-7 rounded-full ${c.bg} transition hover:scale-110 ${newTodo.color === c.key ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1a1d27]' : ''}`} />
                  ))}
                </div>
              </div>
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
              <div>
                <label className="text-gray-400 text-xs mb-2 block">Tags</label>
                <div className="flex gap-1 flex-wrap mb-2">
                  {newTodo.tags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-white ml-0.5">✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }}
                    placeholder="Tag eingeben..."
                    className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-xs focus:outline-none focus:border-blue-500" />
                  <button onClick={() => addTag(tagInput)} className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs transition">+</button>
                </div>
                <div className="flex gap-1 flex-wrap mt-2">
                  {PRESET_TAGS.filter(t => !newTodo.tags.includes(t)).map(tag => (
                    <button key={tag} onClick={() => addTag(tag)}
                      className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-500 border border-white/10 hover:bg-white/10 hover:text-gray-300 transition">
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>
              {canAssign && members.length > 0 && (
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Zuweisen an</label>
                  <select value={newTodo.assigned_to} onChange={e => setNewTodo(p => ({ ...p, assigned_to: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Niemanden zuweisen</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.username}</option>)}
                  </select>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowForm(false)} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg text-sm transition">Abbrechen</button>
                <button onClick={addTodo} disabled={!newTodo.title.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition">
                  ✅ Todo erstellen
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedTodo && (() => {
        const todo     = selectedTodo;
        const status   = STATUS_CONFIG[todo.status || 'open'];
        const priority = PRIORITY_CONFIG[todo.priority];
        const overdue  = isOverdue(todo);
        const colorBorder = COLOR_BORDER[todo.color || 'blue'] || 'border-l-blue-500';
        const canDel   = canDelete(todo);

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className={`bg-[#1a1d27] border border-white/10 border-l-4 ${colorBorder} rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}>
              <div className="p-6 border-b border-white/10 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <button onClick={e => cycleStatus(todo, e)}
                    className={`mt-1 w-7 h-7 rounded-full border-2 flex-shrink-0 flex items-center justify-center text-sm font-bold transition hover:scale-110 ${status.color}`}
                    title="Klicken um Status zu ändern">
                    {status.icon}
                  </button>
                  <div>
                    <h2 className={`text-white font-bold text-lg leading-tight ${todo.completed ? 'line-through text-gray-400' : ''}`}>{todo.title}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded border mt-1 inline-block ${status.color}`}>{status.icon} {status.label}</span>
                  </div>
                </div>
                <button onClick={() => setSelectedTodo(null)} className="text-gray-400 hover:text-white text-xl flex-shrink-0">✕</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Priorität</p>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${priority.color}`}>{priority.label}</span>
                  </div>
                  <div className="bg-[#0f1117] rounded-lg p-3">
                    <p className="text-gray-500 text-xs mb-1">Erstellt am</p>
                    <p className="text-white text-sm">{new Date(todo.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                  {todo.due_date && (
                    <div className={`rounded-lg p-3 ${overdue ? 'bg-red-500/10 border border-red-500/20' : 'bg-[#0f1117]'}`}>
                      <p className="text-gray-500 text-xs mb-1">Fällig am</p>
                      <p className={`text-sm font-medium ${overdue ? 'text-red-400' : 'text-white'}`}>
                        {overdue && '⚠️ '}{new Date(todo.due_date).toLocaleDateString('de-DE')}
                      </p>
                    </div>
                  )}
                  {todo.profiles && (
                    <div className="bg-[#0f1117] rounded-lg p-3">
                      <p className="text-gray-500 text-xs mb-1">Erstellt von</p>
                      <p className="text-purple-400 text-sm font-medium">{todo.profiles.username}</p>
                    </div>
                  )}
                  {todo.assigned_profile && (
                    <div className="bg-[#0f1117] rounded-lg p-3">
                      <p className="text-gray-500 text-xs mb-1">Zugewiesen an</p>
                      <p className="text-blue-400 text-sm font-medium">{todo.assigned_profile.username}</p>
                    </div>
                  )}
                </div>
                {todo.description && (
                  <div className="bg-[#0f1117] rounded-lg p-4">
                    <p className="text-gray-500 text-xs mb-2">Beschreibung</p>
                    <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{todo.description}</p>
                  </div>
                )}
                {(todo.tags || []).length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs mb-2">Tags</p>
                    <div className="flex gap-1 flex-wrap">
                      {(todo.tags || []).map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-300 border border-white/10">{tag}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-gray-500 text-xs mb-2">Status ändern</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG[keyof typeof STATUS_CONFIG]][]).map(([k, v]) => (
                      <button key={k} onClick={async e => {
                        e.stopPropagation();
                        const completed = k === 'done';
                        await supabase.from('todos').update({ status: k, completed, updated_at: new Date().toISOString() }).eq('id', todo.id);
                        setTodos(p => p.map(t => t.id === todo.id ? { ...t, status: k as any, completed } : t));
                        setSelectedTodo(p => p ? { ...p, status: k as any, completed } : null);
                      }}
                        className={`py-2 rounded-lg border text-xs font-medium transition ${(todo.status || 'open') === k ? v.color : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}>
                        {v.icon} {v.label}
                      </button>
                    ))}
                  </div>
                </div>
                {canDel && (
                  <button onClick={() => deleteTodo(todo.id)}
                    className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium py-2.5 rounded-lg text-sm transition">
                    🗑️ Todo löschen
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}


