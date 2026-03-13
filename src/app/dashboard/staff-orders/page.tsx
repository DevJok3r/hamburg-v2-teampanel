'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  product_name: string;
  product_description: string | null;
  price: number | null;
  currency: string;
  status: string;
  progress: number;
  status_tag: string;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
  completed_at: string | null;
}

interface TimelineEntry {
  id: string;
  message: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string; dot: string }> = {
  approved:    { label: 'Freigegeben',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  in_progress: { label: 'In Bearbeitung', bg: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400',  dot: 'bg-violet-400' },
  completed:   { label: 'Abgeschlossen',  bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  cancelled:   { label: 'Storniert',      bg: 'bg-red-500/10',     border: 'border-red-500/30',     text: 'text-red-400',     dot: 'bg-red-400' },
};

const MILESTONES = [
  { p: 0,   icon: '✓', label: 'Bestätigt' },
  { p: 25,  icon: '⚡', label: 'Bearbeitung' },
  { p: 50,  icon: '◈', label: 'Fortschritt' },
  { p: 75,  icon: '◎', label: 'Fast fertig' },
  { p: 100, icon: '✦', label: 'Fertig' },
];

function ProgressRing({ value, size = 80 }: { value: number; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value === 100 ? '#10b981' : value >= 75 ? '#8b5cf6' : value >= 40 ? '#3b82f6' : '#f59e0b';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={5} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1s ease' }} />
    </svg>
  );
}

export default function StaffOrdersPage() {
  const [myId, setMyId]             = useState('');
  const [input, setInput]           = useState('');
  const [order, setOrder]           = useState<Order | null>(null);
  const [timeline, setTimeline]     = useState<TimelineEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError]           = useState('');
  const [myOrders, setMyOrders]     = useState<Order[]>([]);

  const supabase = createClientSupabaseClient();

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMyId(user.id);

      // Lade alle Aufträge bei denen dieser User in allowed_user_ids ist
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, product_name, product_description, price, currency, status, progress, status_tag, notes, created_at, approved_at, completed_at')
        .contains('allowed_user_ids', [user.id])
        .neq('status', 'pending_approval')
        .order('created_at', { ascending: false });

      setMyOrders(data || []);
      setInitLoading(false);
    }
    init();
  }, []);

  async function lookup() {
    const q = input.trim().toUpperCase();
    if (!q) return;
    setLoading(true);
    setError('');
    setOrder(null);
    setTimeline([]);

    // Prüfe ob der User Zugriff auf diesen Auftrag hat
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, product_name, product_description, price, currency, status, progress, status_tag, notes, created_at, approved_at, completed_at')
      .eq('order_number', q)
      .neq('status', 'pending_approval')
      .contains('allowed_user_ids', [myId])
      .single();

    if (!data) {
      setError('Kein Auftrag gefunden oder kein Zugriff. Wende dich an das Management.');
      setLoading(false);
      return;
    }

    await openOrder(data);
    setLoading(false);
  }

  async function openOrder(o: Order) {
    setOrder(o);
    const { data: tl } = await supabase
      .from('order_timeline')
      .select('id, message, created_at')
      .eq('order_id', o.id)
      .order('created_at', { ascending: true });
    setTimeline(tl || []);
  }

  const sc = order ? (STATUS_CONFIG[order.status] || STATUS_CONFIG['approved']) : null;

  if (initLoading) {
    return <div className="text-gray-500 text-center py-16 text-sm">Lade...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-white/10 flex items-center justify-center text-base">◈</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Staff-Orders</h1>
        </div>
        <p className="text-gray-500 text-sm ml-12">Deine freigeschalteten Aufträge</p>
      </div>

      {/* Search */}
      <div className="bg-[#1a1d27] border border-white/[0.07] rounded-2xl p-1.5 flex gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          placeholder="Auftragsnummer eingeben (HV-XXXX-XXXX)..."
          maxLength={14}
          className="flex-1 bg-transparent px-4 py-3 text-white placeholder-gray-600 text-sm font-mono tracking-wider focus:outline-none"
        />
        <button onClick={lookup} disabled={loading || !input.trim()}
          className="bg-white hover:bg-gray-100 disabled:opacity-30 text-gray-900 font-bold text-sm px-5 py-3 rounded-xl transition-all">
          {loading ? '...' : 'Suchen'}
        </button>
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-2xl px-5 py-4 text-center">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* My Orders List */}
      {!order && myOrders.length > 0 && (
        <div>
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Deine freigeschalteten Aufträge</p>
          <div className="space-y-2">
            {myOrders.map(o => {
              const s = STATUS_CONFIG[o.status] || STATUS_CONFIG['approved'];
              return (
                <div key={o.id} onClick={() => openOrder(o)}
                  className="group bg-[#1a1d27] border border-white/[0.07] hover:border-white/[0.15] rounded-2xl px-5 py-4 cursor-pointer transition-all hover:bg-[#1e2132]">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-white font-bold text-sm tracking-widest font-mono">{o.order_number}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${s.bg} ${s.border} ${s.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                      <p className="text-white text-sm font-medium truncate">{o.product_name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{o.status_tag}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-white text-sm font-bold">{o.progress}%</span>
                      <div className="w-20 bg-white/[0.06] rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${o.progress === 100 ? 'bg-emerald-500' : 'bg-blue-500'}`}
                          style={{ width: `${o.progress}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {myOrders.length === 0 && !order && (
        <div className="bg-[#1a1d27] border border-white/[0.07] rounded-2xl py-12 text-center">
          <p className="text-3xl mb-3 opacity-30">◈</p>
          <p className="text-gray-400 font-medium mb-1">Keine Aufträge</p>
          <p className="text-gray-600 text-sm">Du hast noch keinen Zugriff auf Aufträge.<br />Wende dich ans Management.</p>
        </div>
      )}

      {/* Order Detail */}
      {order && sc && (
        <div className="space-y-4">
          <button onClick={() => { setOrder(null); setTimeline([]); setInput(''); }}
            className="flex items-center gap-2 text-gray-500 hover:text-white text-sm transition">
            ← Zurück
          </button>

          {/* Main Card */}
          <div className="bg-[#1a1d27] border border-white/[0.07] rounded-3xl overflow-hidden">
            <div className={`h-1 w-full ${order.status === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : order.status === 'cancelled' ? 'bg-red-600' : 'bg-gradient-to-r from-blue-500 to-violet-500'}`} />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start gap-5 mb-6">
                <div className="relative flex-shrink-0">
                  <ProgressRing value={order.status === 'cancelled' ? 0 : order.progress} size={80} />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-base font-bold ${sc.text}`}>{order.progress}%</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-white font-bold font-mono tracking-widest text-lg">{order.order_number}</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${sc.bg} ${sc.border} ${sc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-white font-semibold text-lg leading-tight">{order.product_name}</p>
                  {order.price && <p className="text-emerald-400 font-bold mt-1">{order.price.toFixed(2)} {order.currency}</p>}
                </div>
              </div>

              {/* Progress Bar */}
              {order.status !== 'cancelled' && (
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-500 text-xs">Fortschritt</span>
                    <span className="text-white text-xs font-bold">{order.status_tag}</span>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-3 mb-3 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-1000 ${order.progress === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-blue-500 to-violet-500'}`}
                      style={{ width: `${order.progress}%` }} />
                  </div>
                  {/* Milestones */}
                  <div className="flex justify-between">
                    {MILESTONES.map(m => {
                      const done = order.progress >= m.p;
                      return (
                        <div key={m.p} className="flex flex-col items-center gap-1.5">
                          <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs transition-all
                            ${done ? 'bg-gradient-to-br from-blue-500 to-violet-500 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/[0.08] text-gray-700'}`}>
                            {done ? '✓' : '·'}
                          </div>
                          <span className={`text-xs hidden sm:block ${done ? 'text-gray-400' : 'text-gray-700'}`}>{m.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status pulse */}
              {order.status !== 'cancelled' && order.status !== 'completed' && (
                <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.05] rounded-xl px-4 py-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
                  <span className="text-white text-sm font-medium">{order.status_tag}</span>
                </div>
              )}
            </div>

            {/* Info Grid */}
            <div className="px-6 pb-6 grid grid-cols-2 gap-3">
              <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/[0.05]">
                <p className="text-gray-600 text-xs mb-1">Bestellt am</p>
                <p className="text-gray-300 text-sm font-medium">{new Date(order.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
              {order.completed_at ? (
                <div className="bg-emerald-950/20 rounded-2xl p-4 border border-emerald-500/10">
                  <p className="text-gray-600 text-xs mb-1">Abgeschlossen</p>
                  <p className="text-emerald-400 text-sm font-medium">{new Date(order.completed_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              ) : (
                <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/[0.05]">
                  <p className="text-gray-600 text-xs mb-1">Produkt</p>
                  <p className="text-gray-300 text-sm font-medium truncate">{order.product_name}</p>
                </div>
              )}
            </div>

            {order.product_description && (
              <div className="mx-6 mb-6 bg-white/[0.02] border border-white/[0.05] rounded-2xl p-4">
                <p className="text-gray-500 text-xs mb-1">Beschreibung</p>
                <p className="text-gray-300 text-sm leading-relaxed">{order.product_description}</p>
              </div>
            )}

            {order.notes && (
              <div className="mx-6 mb-6 bg-blue-950/20 border border-blue-500/10 rounded-2xl p-4">
                <p className="text-blue-400 text-xs font-medium mb-1">📋 Hinweis vom Team</p>
                <p className="text-gray-300 text-sm leading-relaxed">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="bg-[#1a1d27] border border-white/[0.07] rounded-3xl p-6">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-5">Verlauf</p>
              <div className="space-y-0">
                {timeline.map((t, i) => (
                  <div key={t.id} className="flex gap-4">
                    <div className="flex flex-col items-center w-4 flex-shrink-0">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ring-2 ring-[#1a1d27] ${i === timeline.length - 1 ? 'bg-blue-500 ring-blue-500/30' : 'bg-white/20'}`} />
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-white/[0.06] mt-1.5" style={{minHeight:'20px'}} />}
                    </div>
                    <div className="pb-4 flex-1">
                      <p className="text-gray-300 text-xs leading-relaxed">{t.message}</p>
                      <p className="text-gray-700 text-xs mt-1">{new Date(t.created_at).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}