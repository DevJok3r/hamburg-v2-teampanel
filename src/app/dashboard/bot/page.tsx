'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface BotConfig {
  id: string;
  guild_id: string;
  module: string;
  enabled: boolean;
  config: Record<string, any>;
}

interface BotLog {
  id: string;
  action: string;
  moderator_id: string;
  target_id: string;
  reason: string;
  details: Record<string, any>;
  created_at: string;
}

interface TicketCategory {
  label: string;
  emoji: string;
  description: string;
  category_id: string;
  support_role: string;
  color: string;
  message: string;
}

const ACTION_LABELS: Record<string, string> = {
  ban: '🔨 Ban', unban: '✅ Unban', kick: '👢 Kick',
  timeout: '⏱️ Timeout', untimeout: '✅ Untimeout', warn: '⚠️ Warn',
  ticket_open: '🎫 Ticket erstellt', ticket_close: '🔒 Ticket geschlossen',
  chatclear: '🗑️ Chat geleert', role_add: '➕ Rolle gegeben', role_remove: '➖ Rolle entfernt',
};

const ACTION_COLORS: Record<string, string> = {
  ban: 'text-red-400', kick: 'text-orange-400', timeout: 'text-yellow-400',
  warn: 'text-yellow-300', unban: 'text-green-400', untimeout: 'text-green-400',
  ticket_open: 'text-blue-400', ticket_close: 'text-gray-400',
  chatclear: 'text-pink-400', role_add: 'text-cyan-400', role_remove: 'text-red-300',
};

type Tab = 'modules' | 'logs' | 'tickets';

export default function BotDashboardPage() {
  const supabase = createClientSupabaseClient();
  const router   = useRouter();

  const [loading, setLoading]       = useState(true);
  const [myUsername, setMyUsername] = useState('');
  const [guildId, setGuildId]       = useState('');
  const [configs, setConfigs]       = useState<BotConfig[]>([]);
  const [botLogs, setBotLogs]       = useState<BotLog[]>([]);
  const [tab, setTab]               = useState<Tab>('modules');
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, any>>({});
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ text: string; ok: boolean } | null>(null);

  // Ticket categories editor
  const [ticketCategories, setTicketCategories] = useState<TicketCategory[]>([]);

  function showMsg(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/dashboard'); return; }
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    if (!profile || profile.username !== 'jxkerlds') { router.push('/dashboard'); return; }
    setMyUsername(profile.username);

    const savedGuildId = localStorage.getItem('bot_guild_id') || '';
    setGuildId(savedGuildId);

    if (savedGuildId) {
      const [cfgRes, logsRes] = await Promise.all([
        supabase.from('bot_config').select('*').eq('guild_id', savedGuildId),
        supabase.from('bot_logs').select('*').eq('guild_id', savedGuildId).order('created_at', { ascending: false }).limit(100),
      ]);
      setConfigs(cfgRes.data || []);
      setBotLogs(logsRes.data || []);

      const ticketCfg = (cfgRes.data || []).find(c => c.module === 'tickets');
      setTicketCategories(ticketCfg?.config?.categories || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getConfig(module: string) { return configs.find(c => c.module === module); }

  async function toggleModule(module: string) {
    if (!guildId) return showMsg('Bitte zuerst Guild ID eingeben.', false);
    const current = getConfig(module);
    const newEnabled = !(current?.enabled ?? false);
    await supabase.from('bot_config').upsert({ guild_id: guildId, module, enabled: newEnabled, config: current?.config || {} }, { onConflict: 'guild_id,module' });
    setConfigs(prev => {
      const exists = prev.find(c => c.module === module);
      if (exists) return prev.map(c => c.module === module ? { ...c, enabled: newEnabled } : c);
      return [...prev, { id: '', guild_id: guildId, module, enabled: newEnabled, config: {} }];
    });
    showMsg(`${newEnabled ? '✅ Aktiviert' : '⚫ Deaktiviert'}: ${MODULES.find(m => m.key === module)?.label || module}`);
  }

  function openEdit(module: string) {
    const cfg = getConfig(module);
    setEditConfig(cfg?.config || {});
    if (module === 'tickets') setTicketCategories(cfg?.config?.categories || []);
    setEditingModule(module);
  }

  async function saveConfig() {
    if (!editingModule || !guildId) return;
    setSaving(true);
    const current   = getConfig(editingModule);
    const finalConfig = editingModule === 'tickets'
      ? { ...editConfig, categories: ticketCategories }
      : editConfig;

    await supabase.from('bot_config').upsert({
      guild_id: guildId, module: editingModule,
      enabled: current?.enabled ?? false,
      config: finalConfig,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'guild_id,module' });

    setConfigs(prev => {
      const exists = prev.find(c => c.module === editingModule);
      if (exists) return prev.map(c => c.module === editingModule ? { ...c, config: finalConfig } : c);
      return [...prev, { id: '', guild_id: guildId, module: editingModule, enabled: false, config: finalConfig }];
    });

    setSaving(false);
    setEditingModule(null);
    showMsg('✅ Konfiguration gespeichert.');
  }

  async function saveGuildId() {
    localStorage.setItem('bot_guild_id', guildId);
    await load();
    showMsg('✅ Guild ID gespeichert.');
  }

  function addCategory() {
    setTicketCategories(p => [...p, { label: 'Neue Kategorie', emoji: '🎫', description: '', category_id: '', support_role: '', color: '#5865f2', message: 'Hallo {user}! Wir melden uns bald.' }]);
  }

  function updateCategory(idx: number, key: string, value: string) {
    setTicketCategories(p => p.map((c, i) => i === idx ? { ...c, [key]: value } : c));
  }

  function removeCategory(idx: number) {
    setTicketCategories(p => p.filter((_, i) => i !== idx));
  }

  const MODULES = [
    { key: 'moderation', label: 'Moderation', icon: '🛡️', description: 'Ban, Kick, Timeout, Warn, Chatclear, Rolle, Lock/Unlock', color: 'border-red-500/30', fields: [] },
    {
      key: 'welcome', label: 'Willkommen', icon: '👋', description: 'Willkommensnachrichten mit vollen Variablen & Feldern', color: 'border-green-500/30',
      fields: [
        { key: 'channel_id',      label: 'Willkommens-Kanal ID',  type: 'text',     placeholder: '123456789...' },
        { key: 'title',           label: 'Embed Titel',           type: 'text',     placeholder: '👋 Willkommen auf {server}!' },
        { key: 'message',         label: 'Nachricht / Beschreibung', type: 'textarea', placeholder: 'Willkommen {user}!\nDu bist Mitglied **#{membercount}**.\nAccount erstellt: {accountage}' },
        { key: 'color',           label: 'Farbe (Hex)',           type: 'text',     placeholder: '#5865f2' },
        { key: 'image',           label: 'Banner URL',            type: 'text',     placeholder: 'https://...' },
        { key: 'footer',          label: 'Footer Text',           type: 'text',     placeholder: 'Hamburg V2 · Mitglied #{membercount}' },
        { key: 'footer_icon',     label: 'Footer Icon URL',       type: 'text',     placeholder: 'https://...' },
        { key: 'field_1_name',    label: 'Feld 1 – Name',         type: 'text',     placeholder: '📅 Beigetreten' },
        { key: 'field_1_value',   label: 'Feld 1 – Wert',         type: 'text',     placeholder: '{joined}' },
        { key: 'field_2_name',    label: 'Feld 2 – Name',         type: 'text',     placeholder: '📆 Account erstellt' },
        { key: 'field_2_value',   label: 'Feld 2 – Wert',         type: 'text',     placeholder: '{accountage}' },
        { key: 'field_3_name',    label: 'Feld 3 – Name',         type: 'text',     placeholder: '🆔 ID' },
        { key: 'field_3_value',   label: 'Feld 3 – Wert',         type: 'text',     placeholder: '{id}' },
        { key: 'auto_role',       label: 'Auto-Rolle IDs (kommagetrennt)', type: 'text', placeholder: '123456789, 987654321' },
        { key: 'dm_message',      label: 'DM Nachricht (optional)', type: 'textarea', placeholder: 'Willkommen auf {server}, {username}!' },
        { key: 'ping_user',       label: 'Benutzer pingen',       type: 'toggle' },
        { key: 'thumbnail',       label: 'Avatar als Thumbnail',  type: 'toggle' },
        { key: 'show_server_icon',label: 'Server-Icon im Author', type: 'toggle' },
        { key: 'embed',           label: 'Als Embed senden',      type: 'toggle' },
      ],
    },
    {
      key: 'leave', label: 'Abschied', icon: '👋', description: 'Nachrichten wenn Mitglieder den Server verlassen', color: 'border-orange-500/30',
      fields: [
        { key: 'channel_id', label: 'Abschied-Kanal ID', type: 'text',     placeholder: '123456789...' },
        { key: 'title',      label: 'Titel',              type: 'text',     placeholder: '👋 Auf Wiedersehen!' },
        { key: 'message',    label: 'Nachricht',          type: 'textarea', placeholder: '{username} hat den Server verlassen.\nWir waren **{membercount}** Mitglieder.' },
        { key: 'color',      label: 'Farbe (Hex)',         type: 'text',     placeholder: '#ff0000' },
        { key: 'footer',     label: 'Footer',             type: 'text',     placeholder: 'Hamburg V2' },
        { key: 'embed',      label: 'Als Embed senden',   type: 'toggle' },
      ],
    },
    { key: 'tickets', label: 'Ticket System', icon: '🎫', description: 'Support Tickets mit mehreren Kategorien & Select-Menü', color: 'border-blue-500/30', fields: [] },
    {
      key: 'logging', label: 'Logging', icon: '📋', description: 'Alle Moderationsaktionen werden automatisch geloggt', color: 'border-purple-500/30',
      fields: [{ key: 'channel_id', label: 'Log Kanal ID', type: 'text', placeholder: '123456789...' }],
    },
  ];

  const WELCOME_VARS = ['{user}', '{username}', '{displayname}', '{server}', '{membercount}', '{date}', '{time}', '{id}', '{accountage}', '{joined}', '{tag}'];

  const editingModuleData = MODULES.find(m => m.key === editingModule);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-xl">🤖</div>
        <div>
          <h1 className="text-2xl font-bold text-white">Bot Dashboard</h1>
          <p className="text-gray-500 text-xs">Nur für {myUsername} · Hamburg V2 Bot</p>
        </div>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      {/* Guild ID */}
      <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
        <label className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 block">Discord Server ID</label>
        <div className="flex gap-2">
          <input value={guildId} onChange={e => setGuildId(e.target.value)} placeholder="z.B. 123456789012345678"
            className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-blue-500" />
          <button onClick={saveGuildId} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition">Speichern</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1d27] border border-white/10 rounded-xl p-1">
        {([
          { key: 'modules', label: `🧩 Module (${MODULES.length})` },
          { key: 'tickets', label: `🎫 Ticket Kategorien` },
          { key: 'logs',    label: `📋 Bot Logs (${botLogs.length})` },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ MODULE ══ */}
      {tab === 'modules' && (
        <div className="space-y-3">
          {MODULES.map(module => {
            const cfg     = getConfig(module.key);
            const enabled = cfg?.enabled ?? false;
            return (
              <div key={module.key} className={`border rounded-2xl p-5 transition ${enabled ? `${module.color} bg-white/[0.02]` : 'border-white/10 bg-[#1a1d27]'}`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${enabled ? 'bg-white/10' : 'bg-white/5'}`}>
                      {module.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold">{module.label}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-500'}`}>
                          {enabled ? '● Aktiv' : '○ Inaktiv'}
                        </span>
                      </div>
                      <p className="text-gray-500 text-xs mt-0.5">{module.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(module.fields.length > 0 || module.key === 'tickets') && (
                      <button onClick={() => module.key === 'tickets' ? setTab('tickets') : openEdit(module.key)}
                        className="bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                        ✏️ Konfigurieren
                      </button>
                    )}
                    <button onClick={() => toggleModule(module.key)}
                      className={`relative w-12 h-6 rounded-full transition-all ${enabled ? 'bg-blue-600' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${enabled ? 'left-6' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>
                {enabled && cfg?.config && Object.keys(cfg.config).filter(k => typeof cfg.config[k] !== 'boolean' && k !== 'categories').length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-2">
                    {Object.entries(cfg.config).filter(([k, v]) => typeof v === 'string' && v && k !== 'categories').slice(0, 4).map(([k, v]) => (
                      <div key={k} className="bg-black/20 rounded-lg px-3 py-2">
                        <p className="text-gray-500 text-xs">{k.replace(/_/g, ' ')}</p>
                        <p className="text-gray-300 text-xs font-mono truncate">{String(v)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ TICKET KATEGORIEN ══ */}
      {tab === 'tickets' && (
        <div className="space-y-4">
          {/* Globale Ticket Settings */}
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-semibold">⚙️ Globale Einstellungen</h3>
            {[
              { key: 'panel_title',       label: 'Panel Titel',             placeholder: '🎫 Support Ticket' },
              { key: 'panel_description', label: 'Panel Beschreibung',      placeholder: 'Wähle eine Kategorie...' },
              { key: 'select_placeholder',label: 'Select Platzhalter',      placeholder: '📁 Kategorie auswählen...' },
              { key: 'panel_image',       label: 'Panel Banner URL',        placeholder: 'https://...' },
              { key: 'panel_thumbnail',   label: 'Panel Thumbnail URL',     placeholder: 'https://...' },
              { key: 'footer',            label: 'Footer',                  placeholder: 'Hamburg V2 Support' },
              { key: 'color',             label: 'Standard Farbe (Hex)',    placeholder: '#5865f2' },
              { key: 'category_id',       label: 'Standard Kategorie ID',   placeholder: '123456789...' },
              { key: 'support_role',      label: 'Standard Support-Rolle ID', placeholder: '123456789...' },
            ].map(field => {
              const cfg = getConfig('tickets');
              const val = editingModule === 'tickets' ? (editConfig[field.key] || '') : (cfg?.config?.[field.key] || '');
              return (
                <div key={field.key}>
                  <label className="text-gray-400 text-xs mb-1 block">{field.label}</label>
                  <input value={val}
                    onChange={e => {
                      if (editingModule !== 'tickets') { setEditConfig(getConfig('tickets')?.config || {}); setEditingModule('tickets'); }
                      setEditConfig(p => ({ ...p, [field.key]: e.target.value }));
                    }}
                    placeholder={field.placeholder}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              );
            })}
          </div>

          {/* Kategorien */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold">📁 Kategorien ({ticketCategories.length})</h3>
              <button onClick={addCategory}
                className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                + Kategorie hinzufügen
              </button>
            </div>
            {ticketCategories.length === 0 && (
              <div className="text-center py-8 bg-[#1a1d27] border border-dashed border-white/10 rounded-xl">
                <p className="text-gray-500 text-sm">Keine Kategorien. Ohne Kategorien erscheint ein einfacher Button.</p>
              </div>
            )}
            {ticketCategories.map((cat, idx) => (
              <div key={idx} className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.emoji || '🎫'}</span>
                    <span className="text-white font-medium">{cat.label || `Kategorie ${idx + 1}`}</span>
                  </div>
                  <button onClick={() => removeCategory(idx)} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 rounded transition">✕ Entfernen</button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'label',        label: 'Name',              placeholder: 'z.B. Allgemeiner Support' },
                    { key: 'emoji',        label: 'Emoji',             placeholder: '🎫' },
                    { key: 'description',  label: 'Beschreibung',      placeholder: 'Allgemeine Fragen & Probleme' },
                    { key: 'color',        label: 'Farbe (Hex)',       placeholder: '#5865f2' },
                    { key: 'category_id',  label: 'Kategorie ID',      placeholder: '123456789...' },
                    { key: 'support_role', label: 'Support Rollen ID', placeholder: '123456789...' },
                  ].map(field => (
                    <div key={field.key} className={field.key === 'message' ? 'col-span-2' : ''}>
                      <label className="text-gray-500 text-xs mb-1 block">{field.label}</label>
                      <input value={(cat as any)[field.key] || ''} onChange={e => updateCategory(idx, field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="text-gray-500 text-xs mb-1 block">Ticket Nachricht</label>
                    <textarea value={cat.message || ''} onChange={e => updateCategory(idx, 'message', e.target.value)}
                      placeholder="Hallo {user}! Wir kümmern uns bald um dein Anliegen."
                      rows={2}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => { setEditingModule('tickets'); saveConfig(); }}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium py-3 rounded-xl text-sm transition">
            {saving ? 'Speichern...' : '💾 Alle Ticket-Einstellungen speichern'}
          </button>
        </div>
      )}

      {/* ══ LOGS ══ */}
      {tab === 'logs' && (
        <div className="space-y-2">
          {botLogs.length === 0 ? (
            <div className="text-center py-12 bg-[#1a1d27] border border-white/10 rounded-xl">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-gray-400 text-sm">Keine Bot-Logs vorhanden</p>
            </div>
          ) : botLogs.map(log => (
            <div key={log.id} className="bg-[#1a1d27] border border-white/[0.07] rounded-xl px-4 py-3 hover:border-white/15 transition">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0">
                    <span className={`text-sm font-semibold ${ACTION_COLORS[log.action] || 'text-gray-400'}`}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                      {log.moderator_id && <span className="text-blue-400 font-mono">{log.moderator_id.slice(0, 8)}...</span>}
                      {log.target_id    && <><span className="text-gray-600">→</span><span className="text-purple-400 font-mono">{log.target_id.slice(0, 8)}...</span></>}
                    </div>
                    {log.reason && <p className="text-gray-500 text-xs truncate">{log.reason}</p>}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="text-gray-700 text-xs font-mono">
                        {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-gray-700 text-xs flex-shrink-0">
                  {new Date(log.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ══ EDIT MODAL ══ */}
      {editingModule && editingModuleData && editingModule !== 'tickets' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#13151f] border border-white/[0.08] rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-7 py-5 border-b border-white/[0.07] flex items-center justify-between sticky top-0 bg-[#13151f] z-10">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{editingModuleData.icon}</span>
                <div>
                  <h2 className="text-white font-bold">{editingModuleData.label}</h2>
                  <p className="text-gray-500 text-xs">Konfiguration</p>
                </div>
              </div>
              <button onClick={() => setEditingModule(null)} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition">✕</button>
            </div>
            <div className="px-7 py-6 space-y-4">
              {editingModuleData.fields.map((field: any) => (
                <div key={field.key}>
                  <label className="text-gray-400 text-xs mb-1.5 block font-medium">{field.label}</label>
                  {field.type === 'toggle' ? (
                    <button onClick={() => setEditConfig(p => ({ ...p, [field.key]: !p[field.key] }))}
                      className={`relative w-12 h-6 rounded-full transition-all ${editConfig[field.key] ? 'bg-blue-600' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${editConfig[field.key] ? 'left-6' : 'left-0.5'}`} />
                    </button>
                  ) : field.type === 'textarea' ? (
                    <textarea value={editConfig[field.key] || ''} onChange={e => setEditConfig(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder} rows={3}
                      className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none" />
                  ) : (
                    <input value={editConfig[field.key] || ''} onChange={e => setEditConfig(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500" />
                  )}
                </div>
              ))}

              {/* Variablen Hint für Welcome/Leave */}
              {(editingModule === 'welcome' || editingModule === 'leave') && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-400 text-xs font-semibold mb-2">📝 Verfügbare Variablen:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {WELCOME_VARS.map(v => (
                      <span key={v} className="text-blue-300 text-xs font-mono bg-blue-500/20 px-2 py-0.5 rounded">{v}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditingModule(null)} className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-sm transition">Abbrechen</button>
                <button onClick={saveConfig} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold text-sm transition">
                  {saving ? 'Speichern...' : '💾 Speichern'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
