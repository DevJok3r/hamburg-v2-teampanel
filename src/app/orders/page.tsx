'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_discord: string | null;
  customer_email: string | null;
  product_name: string;
  product_description: string | null;
  price: number | null;
  currency: string;
  status: 'pending_approval' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  progress: number;
  status_tag: string;
  notes: string | null;
  internal_notes: string | null;
  allowed_user_ids: string[];
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: { username: string; role: string };
}

interface TimelineEntry {
  id: string;
  order_id: string;
  message: string;
  created_by: string;
  created_at: string;
  author?: { username: string };
}

interface Profile {
  id: string;
  username: string;
  role: string;
  show_staff_orders: boolean;
}

const STATUS_CONFIG = {
  pending_approval: { label: 'Wartet auf Freigabe', short: 'Ausstehend', bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', dot: 'bg-amber-400', icon: '⏳' },
  approved:         { label: 'Freigegeben',          short: 'Freigegeben', bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', dot: 'bg-blue-400', icon: '✓' },
  in_progress:      { label: 'In Bearbeitung',        short: 'Aktiv',      bg: 'bg-violet-500/10', border: 'border-violet-500/30', text: 'text-violet-400', dot: 'bg-violet-400', icon: '⚡' },
  completed:        { label: 'Abgeschlossen',          short: 'Fertig',     bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', dot: 'bg-emerald-400', icon: '✦' },
  cancelled:        { label: 'Storniert',              short: 'Storniert',  bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-400', dot: 'bg-red-400', icon: '✕' },
};

const PRESET_TAGS = [
  'Zahlung ausstehend', 'Zahlung bestätigt', 'Bestellung angenommen',
  'Bestellung in Bearbeitung', 'Qualitätsprüfung', 'Bereitstellung läuft',
  'Warte auf Kundenfeedback', 'Fast fertig', 'Bestellung abgeschlossen',
];

function generateOrderNumber() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return `HV-${code.slice(0,4)}-${code.slice(4)}`;
}

function ProgressRing({ value, size = 48 }: { value: number; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value === 100 ? '#10b981' : value >= 75 ? '#8b5cf6' : value >= 40 ? '#3b82f6' : '#f59e0b';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
    </svg>
  );
}

export default function OrdersManagementPage() {
  const [orders, setOrders]           = useState<Order[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [myRole, setMyRole]           = useState<UserRole | null>(null);
  const [myId, setMyId]               = useState('');
  const [myUsername, setMyUsername]   = useState('');
  const [loading, setLoading]         = useState(true);
  const [activeTab, setActiveTab]     = useState<'all' | 'pending_approval' | 'active' | 'completed' | 'cancelled'>('all');
  const [search, setSearch]           = useState('');
  const [selected, setSelected]       = useState<Order | null>(null);
  const [timeline, setTimeline]       = useState<TimelineEntry[]>([]);
  const [showCreate, setShowCreate]   = useState(false);
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);

  // Create form
  const [cf, setCf] = useState({ name: '', discord: '', email: '', product: '', desc: '', price: '', currency: 'EUR', notes: '', internal: '' });
  const [saving, setSaving] = useState(false);

  // Edit
  const [ed, setEd] = useState({ progress: 0, tag: '', status: 'approved' as Order['status'], internal: '' });
  const [tlMsg, setTlMsg] = useState('');
  const [savingEd, setSavingEd] = useState(false);

  // Access control
  const [showAccess, setShowAccess] = useState(false);
  const [accessOrder, setAccessOrder] = useState<Order | null>(null);
  const [accessSearch, setAccessSearch] = useState('');

  // show_staff_orders toggle
  const [togglingUser, setTogglingUser] = useState<string | null>(null);

  const supabase = createClientSupabaseClient();

  function notify(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);
    const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', user.id).single();
    if (profile) { setMyRole(profile.role as UserRole); setMyUsername(profile.username); }

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*, creator:profiles!orders_created_by_fkey(username, role)')
      .order('created_at', { ascending: false });
    setOrders(ordersData || []);

    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, role, show_staff_orders')
      .eq('is_active', true)
      .order('username');
    setAllProfiles(profilesData || []);

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const isTopManagement = myRole === 'top_management';

  async function openOrder(id: string) {
    const { data: o } = await supabase
      .from('orders')
      .select('*, creator:profiles!orders_created_by_fkey(username, role)')
      .eq('id', id).single();
    if (o) {
      setSelected(o);
      setEd({ progress: o.progress, tag: o.status_tag, status: o.status, internal: o.internal_notes || '' });
    }
    const { data: tl } = await supabase
      .from('order_timeline')
      .select('*, author:profiles!order_timeline_created_by_fkey(username)')
      .eq('order_id', id).order('created_at', { ascending: true });
    setTimeline(tl || []);
  }

  async function createOrder() {
    if (!cf.name.trim() || !cf.product.trim()) return;
    setSaving(true);
    await supabase.from('orders').insert({
      order_number: generateOrderNumber(),
      customer_name: cf.name, customer_discord: cf.discord || null,
      customer_email: cf.email || null, product_name: cf.product,
      product_description: cf.desc || null,
      price: cf.price ? parseFloat(cf.price) : null,
      currency: cf.currency, notes: cf.notes || null,
      internal_notes: cf.internal || null,
      status: 'pending_approval', progress: 0,
      status_tag: 'Zahlung ausstehend', created_by: myId,
      allowed_user_ids: [],
    });
    setSaving(false);
    setShowCreate(false);
    setCf({ name: '', discord: '', email: '', product: '', desc: '', price: '', currency: 'EUR', notes: '', internal: '' });
    notify('Auftrag erstellt.');
    load();
  }

  async function approveOrder(o: Order) {
    await supabase.from('orders').update({
      status: 'approved', approved_by: myId,
      approved_at: new Date().toISOString(),
      status_tag: 'Zahlung bestätigt', progress: 15,
    }).eq('id', o.id);
    await supabase.from('order_timeline').insert({
      order_id: o.id,
      message: `Auftrag freigegeben. Auftragsnummer aktiv: ${o.order_number}`,
      created_by: myId,
    });
    notify(`✓ ${o.order_number} freigegeben!`);
    load();
    if (selected?.id === o.id) openOrder(o.id);
  }

  async function saveEdit() {
    if (!selected) return;
    setSavingEd(true);
    await supabase.from('orders').update({
      status: ed.status, progress: ed.progress,
      status_tag: ed.tag, internal_notes: ed.internal || null,
      updated_at: new Date().toISOString(),
      completed_at: ed.status === 'completed' ? new Date().toISOString() : null,
    }).eq('id', selected.id);
    await supabase.from('order_timeline').insert({
      order_id: selected.id,
      message: `Status aktualisiert: "${ed.tag}" · ${ed.progress}% (von ${myUsername})`,
      created_by: myId,
    });
    setSavingEd(false);
    notify('Gespeichert.');
    load();
    openOrder(selected.id);
  }

  async function addTimeline() {
    if (!tlMsg.trim() || !selected) return;
    await supabase.from('order_timeline').insert({
      order_id: selected.id, message: tlMsg, created_by: myId,
    });
    setTlMsg('');
    openOrder(selected.id);
  }

  async function cancelOrder(o: Order) {
    if (!confirm(`Auftrag ${o.order_number} wirklich stornieren?`)) return;
    await supabase.from('orders').update({ status: 'cancelled', status_tag: 'Storniert', progress: 0 }).eq('id', o.id);
    await supabase.from('order_timeline').insert({ order_id: o.id, message: `Auftrag storniert von ${myUsername}`, created_by: myId });
    notify('Storniert.', false);
    setSelected(null);
    load();
  }

  async function deleteOrder(o: Order) {
    if (!confirm(`Auftrag ${o.order_number} endgültig löschen?`)) return;
    await supabase.from('orders').delete().eq('id', o.id);
    notify('Gelöscht.', false);
    setSelected(null);
    load();
  }

  async function toggleAccess(order: Order, userId: string) {
    const current = order.allowed_user_ids || [];
    const updated = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    await supabase.from('orders').update({ allowed_user_ids: updated }).eq('id', order.id);
    setAccessOrder(prev => prev ? { ...prev, allowed_user_ids: updated } : null);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, allowed_user_ids: updated } : o));
    if (selected?.id === order.id) setSelected(prev => prev ? { ...prev, allowed_user_ids: updated } : null);
  }

  async function toggleShowStaffOrders(userId: string, current: boolean) {
    setTogglingUser(userId);
    await supabase.from('profiles').update({ show_staff_orders: !current }).eq('id', userId);
    setAllProfiles(prev => prev.map(p => p.id === userId ? { ...p, show_staff_orders: !current } : p));
    setTogglingUser(null);
    notify(!current ? 'Staff-Orders Tab aktiviert.' : 'Staff-Orders Tab deaktiviert.', !current);
  }

  const filtered = orders.filter(o => {
    if (activeTab === 'active') { if (!['approved','in_progress'].includes(o.status)) return false; }
    else if (activeTab !== 'all') { if (o.status !== activeTab) return false; }
    if (search) {
      const q = search.toLowerCase();
      return o.order_number.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q) || o.product_name.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = {
    all: orders.length,
    pending_approval: orders.filter(o => o.status === 'pending_approval').length,
    active: orders.filter(o => ['approved','in_progress'].includes(o.status)).length,
    completed: orders.filter(o => o.status === 'completed').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };

  const accessFilteredProfiles = allProfiles.filter(p =>
    !accessSearch || p.username.toLowerCase().includes(accessSearch.toLowerCase())
  );

  if (!isTopManagement && myRole !== null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-4xl mb-3">🔒</p>
          <p className="text-white font-medium mb-1">Kein Zugriff</p>
          <p className="text-gray-500 text-sm">Nur Top Management kann Aufträge verwalten.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-xl text-sm font-medium shadow-2xl border backdrop-blur-sm
          ${toast.ok ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' : 'bg-red-950/90 text-red-300 border-red-500/30'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center text-white text-base">◈</div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Aufträge</h1>
          </div>
          <p className="text-gray-500 text-sm ml-12">Bestellverwaltung · {orders.length} Aufträge</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAccess(true)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
            🔑 Zugriffssteuerung
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-all">
            + Neuer Auftrag
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Ausstehend', val: counts.pending_approval, from: 'from-amber-600', to: 'to-orange-600', icon: '⏳' },
          { label: 'Aktiv',      val: counts.active,           from: 'from-blue-600',  to: 'to-violet-600', icon: '⚡' },
          { label: 'Fertig',     val: counts.completed,        from: 'from-emerald-600', to: 'to-teal-600', icon: '✦' },
          { label: 'Gesamt',     val: counts.all,              from: 'from-slate-600', to: 'to-slate-700',  icon: '◈' },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1d27] border border-white/[0.07] rounded-2xl p-4 relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${s.from} ${s.to} opacity-[0.04]`} />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-500 text-xs font-medium uppercase tracking-wider">{s.label}</span>
                <span className="text-base">{s.icon}</span>
              </div>
              <span className="text-3xl font-bold text-white">{s.val}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-0.5 bg-[#1a1d27] border border-white/[0.07] rounded-xl p-1">
          {[
            { key: 'all', label: 'Alle' },
            { key: 'pending_approval', label: '⏳ Freigabe' },
            { key: 'active', label: '⚡ Aktiv' },
            { key: 'completed', label: '✦ Fertig' },
            { key: 'cancelled', label: '✕ Storniert' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === t.key ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
              {counts[t.key as keyof typeof counts] > 0 && (
                <span className={`ml-1.5 text-xs ${activeTab === t.key ? 'text-gray-300' : 'text-gray-600'}`}>
                  {counts[t.key as keyof typeof counts]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-48 relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Suche..."
            className="w-full bg-[#1a1d27] border border-white/[0.07] rounded-xl pl-4 pr-4 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/20" />
        </div>
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="text-gray-600 text-center py-16 text-sm">Lade...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-[#1a1d27] border border-white/[0.07] rounded-2xl py-16 text-center">
          <p className="text-gray-500 text-sm">Keine Aufträge in dieser Kategorie.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => {
            const sc = STATUS_CONFIG[o.status];
            return (
              <div key={o.id} onClick={() => openOrder(o.id)}
                className="group bg-[#1a1d27] border border-white/[0.07] hover:border-white/[0.15] rounded-2xl px-5 py-4 cursor-pointer transition-all hover:bg-[#1e2132]">
                <div className="flex items-center gap-4">
                  <div className="relative flex-shrink-0">
                    <ProgressRing value={['pending_approval','cancelled'].includes(o.status) ? 0 : o.progress} size={48} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className={`text-xs font-bold ${sc.text}`}>
                        {o.status === 'pending_approval' ? '?' : o.status === 'cancelled' ? '✕' : `${o.progress}%`}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-bold text-sm tracking-widest font-mono">{o.order_number}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${sc.bg} ${sc.border} ${sc.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.short}
                      </span>
                      {o.status !== 'pending_approval' && o.status !== 'cancelled' && (
                        <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full border border-white/[0.07]">{o.status_tag}</span>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium truncate">{o.product_name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-gray-500 text-xs">👤 {o.customer_name}</span>
                      {o.price && <span className="text-emerald-500 text-xs font-medium">{o.price.toFixed(2)} {o.currency}</span>}
                      <span className="text-gray-700 text-xs">🔑 {(o.allowed_user_ids || []).length} Zugriff</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <span className="text-gray-600 text-xs">{new Date(o.created_at).toLocaleDateString('de-DE')}</span>
                    <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-500 transition" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ MODAL: Create ══ */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#13151f] border border-white/[0.08] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-7 py-5 border-b border-white/[0.07] flex items-center justify-between sticky top-0 bg-[#13151f] z-10">
              <h2 className="text-white font-bold text-lg">Neuer Auftrag</h2>
              <button onClick={() => setShowCreate(false)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition">✕</button>
            </div>
            <div className="px-7 py-6 space-y-4">
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Kunde</p>
                <div className="space-y-2">
                  <input value={cf.name} onChange={e => setCf(p => ({...p, name: e.target.value}))} placeholder="Kundenname *"
                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={cf.discord} onChange={e => setCf(p => ({...p, discord: e.target.value}))} placeholder="Discord"
                      className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25" />
                    <input value={cf.email} onChange={e => setCf(p => ({...p, email: e.target.value}))} placeholder="E-Mail"
                      className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25" />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Produkt</p>
                <div className="space-y-2">
                  <input value={cf.product} onChange={e => setCf(p => ({...p, product: e.target.value}))} placeholder="Produktname / Leistung *"
                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25" />
                  <textarea value={cf.desc} onChange={e => setCf(p => ({...p, desc: e.target.value}))} placeholder="Beschreibung..." rows={2}
                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25 resize-none" />
                  <div className="flex gap-2">
                    <input type="number" value={cf.price} onChange={e => setCf(p => ({...p, price: e.target.value}))} placeholder="Preis"
                      className="flex-1 bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25" />
                    <select value={cf.currency} onChange={e => setCf(p => ({...p, currency: e.target.value}))}
                      className="w-28 bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/25">
                      <option>EUR</option><option>USD</option><option>Robux</option><option>Coins</option>
                    </select>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Notizen</p>
                <div className="space-y-2">
                  <textarea value={cf.notes} onChange={e => setCf(p => ({...p, notes: e.target.value}))} placeholder="Für Kunden sichtbar..." rows={2}
                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25 resize-none" />
                  <textarea value={cf.internal} onChange={e => setCf(p => ({...p, internal: e.target.value}))} placeholder="Interne Notiz (nur Staff)..." rows={2}
                    className="w-full bg-amber-950/20 border border-amber-500/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-amber-500/40 resize-none" />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowCreate(false)} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-sm transition">Abbrechen</button>
                <button onClick={createOrder} disabled={saving || !cf.name.trim() || !cf.product.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-white text-gray-900 font-semibold text-sm hover:bg-gray-100 disabled:opacity-30 transition">
                  {saving ? 'Erstelle...' : 'Auftrag erstellen →'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Access Control ══ */}
      {showAccess && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#13151f] border border-white/[0.08] rounded-3xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="px-7 py-5 border-b border-white/[0.07] flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">🔑 Zugriffssteuerung</h2>
                <p className="text-gray-500 text-xs mt-0.5">Schalte Staff-Orders Tab für Mitglieder frei</p>
              </div>
              <button onClick={() => { setShowAccess(false); setAccessOrder(null); setAccessSearch(''); }}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition">✕</button>
            </div>

            {/* Order selector */}
            <div className="px-7 py-4 border-b border-white/[0.07]">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Auftrag wählen (für Einzel-Zugriff)</p>
              <select
                value={accessOrder?.id || ''}
                onChange={e => {
                  const o = orders.find(x => x.id === e.target.value) || null;
                  setAccessOrder(o);
                }}
                className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/25">
                <option value="">— Kein Auftrag ausgewählt (nur Tab-Zugriff verwalten) —</option>
                {orders.filter(o => o.status !== 'cancelled').map(o => (
                  <option key={o.id} value={o.id}>{o.order_number} · {o.product_name} · {o.customer_name}</option>
                ))}
              </select>
            </div>

            <div className="px-7 py-4 border-b border-white/[0.07]">
              <input value={accessSearch} onChange={e => setAccessSearch(e.target.value)} placeholder="Mitglied suchen..."
                className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25" />
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="px-7 py-3">
                <div className="grid grid-cols-2 gap-1 text-xs text-gray-600 font-semibold uppercase tracking-wider px-2 mb-2">
                  <span>Mitglied</span>
                  <div className="flex justify-end gap-8 pr-1">
                    <span>Tab</span>
                    {accessOrder && <span>Auftrag</span>}
                  </div>
                </div>
                {accessFilteredProfiles.map(p => {
                  const hasOrderAccess = accessOrder ? (accessOrder.allowed_user_ids || []).includes(p.id) : false;
                  return (
                    <div key={p.id} className="flex items-center justify-between px-2 py-2.5 hover:bg-white/[0.02] rounded-xl transition">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-gradient-to-br from-blue-500/30 to-violet-500/30 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{p.username}</p>
                          <p className="text-gray-600 text-xs">{p.role}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        {/* show_staff_orders toggle */}
                        <button
                          onClick={() => toggleShowStaffOrders(p.id, p.show_staff_orders)}
                          disabled={togglingUser === p.id}
                          className={`relative w-10 h-5 rounded-full transition-all ${p.show_staff_orders ? 'bg-blue-600' : 'bg-white/10'} ${togglingUser === p.id ? 'opacity-50' : ''}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${p.show_staff_orders ? 'left-5' : 'left-0.5'}`} />
                        </button>

                        {/* Per-order access toggle */}
                        {accessOrder && (
                          <button
                            onClick={() => toggleAccess(accessOrder, p.id)}
                            className={`relative w-10 h-5 rounded-full transition-all ${hasOrderAccess ? 'bg-emerald-600' : 'bg-white/10'}`}>
                            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${hasOrderAccess ? 'left-5' : 'left-0.5'}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-7 py-4 border-t border-white/[0.07] bg-[#13151f]">
              <div className="flex items-center gap-4 text-xs text-gray-600">
                <div className="flex items-center gap-1.5"><div className="w-4 h-2.5 bg-blue-600 rounded-full" /><span>Tab sichtbar</span></div>
                {accessOrder && <div className="flex items-center gap-1.5"><div className="w-4 h-2.5 bg-emerald-600 rounded-full" /><span>Auftragszugriff</span></div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Order Detail ══ */}
      {selected && (() => {
        const sc = STATUS_CONFIG[selected.status];
        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-[#13151f] border border-white/[0.08] rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
              {/* Header */}
              <div className="p-6 border-b border-white/[0.07]">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="relative flex-shrink-0 mt-1">
                      <ProgressRing value={['pending_approval','cancelled'].includes(selected.status) ? 0 : selected.progress} size={64} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className={`text-sm font-bold ${sc.text}`}>
                          {selected.status === 'pending_approval' ? '?' : selected.status === 'cancelled' ? '✕' : `${selected.progress}%`}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-white font-bold font-mono tracking-widest text-lg">{selected.order_number}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${sc.bg} ${sc.border} ${sc.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                          {sc.label}
                        </span>
                      </div>
                      <p className="text-white font-semibold text-lg">{selected.product_name}</p>
                      <p className="text-gray-500 text-sm">👤 {selected.customer_name}{selected.customer_discord && ` · 💬 ${selected.customer_discord}`}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition flex-shrink-0">✕</button>
                </div>
                {selected.status !== 'pending_approval' && selected.status !== 'cancelled' && (
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500 text-xs">Fortschritt</span>
                      <span className="text-white text-xs font-bold">{selected.status_tag}</span>
                    </div>
                    <div className="w-full bg-white/[0.06] rounded-full h-2.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-700 ${selected.progress === 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-blue-500 to-violet-500'}`}
                        style={{ width: `${selected.progress}%` }} />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-5">
                {/* Quick access toggle for this order */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4">
                  <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">🔑 Auftragszugriff ({(selected.allowed_user_ids || []).length} Personen)</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(selected.allowed_user_ids || []).map(uid => {
                      const u = allProfiles.find(p => p.id === uid);
                      return u ? (
                        <div key={uid} className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-full">
                          {u.username}
                          <button onClick={() => toggleAccess(selected, uid)} className="hover:text-red-400 transition">✕</button>
                        </div>
                      ) : null;
                    })}
                    {(selected.allowed_user_ids || []).length === 0 && <p className="text-gray-600 text-xs">Noch niemand hat Zugriff.</p>}
                  </div>
                  <select onChange={e => { if (e.target.value) { toggleAccess(selected, e.target.value); e.target.value = ''; }}}
                    className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-white/25">
                    <option value="">+ Person hinzufügen...</option>
                    {allProfiles.filter(p => !(selected.allowed_user_ids || []).includes(p.id)).map(p => (
                      <option key={p.id} value={p.id}>{p.username} ({p.role})</option>
                    ))}
                  </select>
                </div>

                {selected.notes && (
                  <div className="bg-blue-950/20 border border-blue-500/10 rounded-2xl p-4">
                    <p className="text-blue-400 text-xs mb-2 font-medium">📋 Kundennotiz</p>
                    <p className="text-gray-300 text-sm">{selected.notes}</p>
                  </div>
                )}
                {selected.internal_notes && (
                  <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl p-4">
                    <p className="text-amber-400 text-xs mb-2 font-medium">🔒 Interne Notiz</p>
                    <p className="text-gray-300 text-sm">{selected.internal_notes}</p>
                  </div>
                )}

                {/* Timeline */}
                {timeline.length > 0 && (
                  <div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Verlauf</p>
                    <div className="space-y-0">
                      {timeline.map((t, i) => (
                        <div key={t.id} className="flex gap-4">
                          <div className="flex flex-col items-center w-4 flex-shrink-0">
                            <div className={`w-2 h-2 rounded-full mt-1.5 ring-2 ring-[#13151f] ${i === timeline.length - 1 ? 'bg-blue-500' : 'bg-white/20'}`} />
                            {i < timeline.length - 1 && <div className="w-px flex-1 bg-white/[0.06] mt-1.5" style={{minHeight:'20px'}} />}
                          </div>
                          <div className="pb-3 flex-1">
                            <p className="text-gray-300 text-xs">{t.message}</p>
                            <p className="text-gray-700 text-xs mt-0.5">{t.author?.username} · {new Date(t.created_at).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edit */}
                {selected.status !== 'cancelled' && (
                  <div className="border-t border-white/[0.07] pt-5 space-y-4">
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Bearbeiten</p>

                    {selected.status === 'pending_approval' && (
                      <button onClick={() => approveOrder(selected)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl transition text-sm">
                        ✓ Auftrag freigeben
                      </button>
                    )}

                    {selected.status !== 'pending_approval' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-gray-500 text-xs mb-2 block">Status</label>
                            <select value={ed.status} onChange={e => setEd(p => ({...p, status: e.target.value as Order['status']}))}
                              className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none">
                              <option value="approved">Freigegeben</option>
                              <option value="in_progress">In Bearbeitung</option>
                              <option value="completed">Abgeschlossen</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-gray-500 text-xs mb-2 block">Fortschritt: <span className="text-white font-bold">{ed.progress}%</span></label>
                            <input type="range" min={0} max={100} step={5} value={ed.progress}
                              onChange={e => setEd(p => ({...p, progress: parseInt(e.target.value)}))}
                              className="w-full accent-blue-500 mt-1.5" />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[0,10,25,50,75,90,100].map(p => (
                            <button key={p} onClick={() => setEd(prev => ({...prev, progress: p}))}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition ${ed.progress === p ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-white/5 text-gray-500 border-white/[0.08] hover:text-white'}`}>
                              {p}%
                            </button>
                          ))}
                        </div>
                        <div>
                          <label className="text-gray-500 text-xs mb-2 block">Status-Tag</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {PRESET_TAGS.map(tag => (
                              <button key={tag} onClick={() => setEd(p => ({...p, tag}))}
                                className={`text-xs px-3 py-1.5 rounded-xl border transition ${ed.tag === tag ? 'bg-white/10 text-white border-white/20' : 'bg-white/[0.03] text-gray-500 border-white/[0.07] hover:text-gray-300'}`}>
                                {tag}
                              </button>
                            ))}
                          </div>
                          <input value={ed.tag} onChange={e => setEd(p => ({...p, tag: e.target.value}))} placeholder="Eigener Tag..."
                            className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25" />
                        </div>
                        <textarea value={ed.internal} onChange={e => setEd(p => ({...p, internal: e.target.value}))} rows={2}
                          placeholder="🔒 Interne Notiz..."
                          className="w-full bg-amber-950/20 border border-amber-500/20 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none resize-none" />
                        <button onClick={saveEdit} disabled={savingEd}
                          className="w-full py-3 rounded-2xl bg-white text-gray-900 font-bold text-sm hover:bg-gray-100 disabled:opacity-30 transition">
                          {savingEd ? 'Speichern...' : 'Speichern'}
                        </button>
                      </>
                    )}

                    <div className="flex gap-2">
                      <input value={tlMsg} onChange={e => setTlMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTimeline()}
                        placeholder="Verlaufseintrag..."
                        className="flex-1 bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-white/25" />
                      <button onClick={addTimeline} disabled={!tlMsg.trim()}
                        className="px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition disabled:opacity-30">+</button>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => cancelOrder(selected)}
                        className="flex-1 py-2.5 rounded-xl bg-red-950/30 hover:bg-red-950/50 text-red-400 border border-red-500/20 text-sm transition">Stornieren</button>
                      <button onClick={() => deleteOrder(selected)}
                        className="flex-1 py-2.5 rounded-xl bg-red-950/30 hover:bg-red-950/50 text-red-400 border border-red-500/20 text-sm transition">Löschen</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}