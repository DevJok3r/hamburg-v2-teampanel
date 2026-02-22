'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Todo } from '@/types';

const PRIORITY_STYLES = {
  high:   'text-red-400 bg-red-500/10 border-red-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
  low:    'text-green-400 bg-green-500/10 border-green-500/30',
};

const PRIORITY_LABELS = { high: 'Hoch', medium: 'Mittel', low: 'Niedrig' };

export default function TodosPage() {
  const [todos, setTodos]       = useState<Todo[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTodo, setNewTodo]   = useState({
    title: '', description: '', priority: 'medium' as Todo['priority'], due_date: '',
  });

  const supabase = createClientSupabaseClient();

  async function loadTodos() {
    const { data } = await supabase
      .from('todos')
      .select('*')
      .order('completed')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    setTodos(data || []);
    setLoading(false);
  }

  useEffect(() => { loadTodos(); }, []);

  async function addTodo() {
    if (!newTodo.title.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('todos').insert({
      ...newTodo,
      user_id: user!.id,
      due_date: newTodo.due_date || null,
    });
    setNewTodo({ title: '', description: '', priority: 'medium', due_date: '' });
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

  const open      = todos.filter(t => !t.completed);
  const completed = todos.filter(t => t.completed);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Meine Todos</h1>
          <p className="text-gray-400 text-sm mt-1">{open.length} offen · {completed.length} erledigt</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg
                     transition flex items-center gap-2 text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Todo hinzufügen
        </button>
      </div>

      {showForm && (
        <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
          <input
            value={newTodo.title}
            onChange={e => setNewTodo(p => ({ ...p, title: e.target.value }))}
            placeholder="Todo Titel..."
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                       text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm"
          />
          <textarea
            value={newTodo.description}
            onChange={e => setNewTodo(p => ({ ...p, description: e.target.value }))}
            placeholder="Beschreibung (optional)..."
            rows={2}
            className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                       text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
          />
          <div className="flex gap-3">
            <select
              value={newTodo.priority}
              onChange={e => setNewTodo(p => ({ ...p, priority: e.target.value as Todo['priority'] }))}
              className="bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                         focus:outline-none focus:border-blue-500"
            >
              <option value="low">Priorität: Niedrig</option>
              <option value="medium">Priorität: Mittel</option>
              <option value="high">Priorität: Hoch</option>
            </select>
            <input
              type="date"
              value={newTodo.due_date}
              onChange={e => setNewTodo(p => ({ ...p, due_date: e.target.value }))}
              className="bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white text-sm
                         focus:outline-none focus:border-blue-500"
            />
            <button onClick={addTodo}
              className="ml-auto bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2
                         rounded-lg transition text-sm">
              Hinzufügen
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-center py-12">Lade...</div>
      ) : (
        <div className="space-y-2">
          {open.map(todo => (
            <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
          ))}
          {open.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Keine offenen Todos 🎉
            </div>
          )}
        </div>
      )}

      {completed.length > 0 && (
        <div>
          <h3 className="text-gray-400 text-sm font-medium mb-2">Erledigt</h3>
          <div className="space-y-2 opacity-60">
            {completed.map(todo => (
              <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TodoItem({ todo, onToggle, onDelete }: {
  todo: Todo;
  onToggle: (id: string, c: boolean) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="bg-[#1a1d27] border border-white/10 rounded-xl px-5 py-4
                    flex items-center gap-4 group hover:border-white/20 transition">
      <button
        onClick={() => onToggle(todo.id, todo.completed)}
        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition
          ${todo.completed ? 'bg-green-500 border-green-500' : 'border-gray-500 hover:border-blue-400'}`}
      >
        {todo.completed && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${todo.completed ? 'line-through text-gray-500' : 'text-white'}`}>
          {todo.title}
        </p>
        {todo.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{todo.description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {todo.due_date && (
          <span className="text-xs text-gray-400">
            {new Date(todo.due_date).toLocaleDateString('de-DE')}
          </span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded border ${PRIORITY_STYLES[todo.priority]}`}>
          {PRIORITY_LABELS[todo.priority]}
        </span>
        <button
          onClick={() => onDelete(todo.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition ml-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5
                 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}