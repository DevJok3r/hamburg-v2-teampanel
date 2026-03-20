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

const MODULES = [
  {
    key: 'moderation',
    label: 'Moderation',
    icon: '🛡️',
    description: 'Ban, Kick, Timeout, Warn Commands',
    color: 'border-red-500/30 bg-red-500/5',
    fields: [],
  },
  {
    key: 'welcome',
    label: 'Willkommen',
    icon: '👋',
    description: 'Willkommensnachrichten für neue Mitglieder',
    color: 'border-green-500/30 bg-green-500/5',
    fields: [
      { key: 'channel_id',  label: 'Kanal ID',        type: 'text',     placeholder: '123456789...' },
      { key: 'title',       label: 'Titel',             type: 'text',     placeholder: 'Willkommen auf {server}!' },
      { key: 'message',     label: 'Nachricht',         type: 'textarea', placeholder: 'Willkommen {user} auf {server}! Du bist Mitglied #{membercount}.' },
      { key: 'color',       label: 'Farbe (Hex)',       type: 'text',     placeholder: '#5865f2' },
      { key: 'image',       label: 'Banner URL',        type: 'text',     placeholder: 'https://...' },
      { key: 'footer',      label: 'Footer',            type: 'text',     placeholder: 'Hamburg V2' },
      { key: 'auto_role',   label: 'Auto-Rolle ID',     type: 'text',     placeholder: '123456789...' },
      { key: 'embed',       label: 'Als Embed senden',  type: 'toggle' },
    ],
  },
  {
    key: 'tickets',
    label: 'Ticket System',
    icon: '🎫',
    description: 'Support Ticket System mit Kategorien',
    color: 'border-blue-500/30 bg-blue-500/5',
    fields: [
      { key: 'category_id',        label: 'Kategorie ID',         type: 'text',     placeholder: '123456789...' },
      { key: 'support_role',       label: 'Support Rollen ID',    type: 'text',     placeholder: '123456789...' },
      { key: 'panel_title',        label: 'Panel Titel',          type: 'text',     placeholder: '🎫 Support Ticket' },
      { key: 'panel_description',  label: 'Panel Beschreibung',   type: 'textarea', placeholder: 'Klicke den Button um ein Ticket zu erstellen.' },
      { key: 'button_label',       label: 'Button Text',          type: 'text',     placeholder: '📩 Ticket erstellen' },
      { key: 'ticket_title',       label: 'Ticket Titel',         type: 'text',     placeholder: '🎫 Ticket erstellt' },
      { key: 'ticket_message',     label: 'Ticket Nachricht',     type: 'textarea', placeholder: 'Hallo {user}! Ein Mitglied des Support-Teams wird sich bald bei dir melden.' },
      { key: 'color',              label: 'Farbe (Hex)',          type: 'text',     placeholder: '#5865f2' },
      { key: 'footer',             label: 'Footer',               type: 'text',     placeholder: 'Hamburg V2 Support' },
      { key: 'default_topic',      label: 'Standard Thema',       type: 'text',     placeholder: 'Support' },
    ],
  },
  {
    key: 'logging',
    label: 'Logging',
    icon: '📋',
    description: 'Alle Moderationsaktionen automatisch loggen',
    color: 'border-purple-500/30 bg-purple-500/5',
    fields: [
      { key: 'channel_id', label: 'Log Kanal ID', type: 'text', placeholder: '123456789...' },
    ],
  },
  {
    key: 'automod',
    label: 'Auto-Moderation',
    icon: '🤖',
    description: 'Automatische Moderation (Links, Spam, Beleidigungen)',
    color: 'border-orange-500/30 bg-orange-500/5',
    fields: [
      { key: 'filter_links',    label: 'Links filtern',       type: 'toggle' },
      { key: 'filter_spam',     label: 'Spam filtern',        type: 'toggle' },
      { key: 'filter_caps',     label: 'Großbuchstaben',      type: 'toggle' },
      { key: 'log_channel',     label: 'Log Kanal ID',        type: 'text', placeholder: '123456789...' },
      { key: 'warn_on_filter',  label: 'Auto-Warn bei Filter',type: 'toggle' },
      { key: 'whitelist_roles', label: 'Whitelist Rollen IDs', type: 'text', placeholder: 'ID1,ID2,...' },
    ],
  },
];

const ACTION_LABELS: Record<string, string> = {
  ban: '🔨 Ban', unban: '✅ Unban', kick: '👢 Kick',
  timeout: '⏱️ Timeout', untimeout: '✅ Untimeout',
  warn: '⚠️ Warn', ticket_open: '🎫 Ticket erstellt',
  ticket_close: '🔒 Ticket geschlossen', chatclear: '🗑️ Chat geleert',
};

export default function BotDashboardPage() {
  const supabase = createClientSupabaseClient();
  const router   = useRouter();

  const [loading, setLoading]       = useState(true);
  const [myUsername, setMyUsername] = useState('');
  const [guildId, setGuildId]       = useState('');
  const [configs, setConfigs]       = useState<BotConfig[]>([]);
  const [botLogs, setBotLogs]       = useState<BotLog[]>([]);
  const [activeTab, setActiveTab]   = useState<'modules' | 'logs'>('modules');
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<Record<string, any>>({});
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ text: string; ok: boolean } | null>(null);

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
        supabase.from('bot_logs').select('*').eq('guild_id', savedGuildId).order('created_at', { ascending: false }).limit(50),
      ]);
      setConfigs(cfgRes.data || []);
      setBotLogs(logsRes.data || []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function getConfig(module: string): BotConfig | undefined {
    return configs.find(c => c.module === module);
  }

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
    showMsg(`${newEnabled ? '✅ Aktiviert' : '⚫ Deaktiviert'}: ${module}`);
  }

  function openEdit(module: string) {
    const cfg = getConfig(module);
    setEditConfig(cfg?.config || {});
    setEditingModule(module);
  }

  async function saveConfig() {
    if (!editingModule || !guildId) return;
    setSaving(true);
    const current = getConfig(editingModule);
    await supabase.from('bot_config').upsert({ guild_id: guildId, module: editingModule, enabled: current?.enabled ?? false, config: editConfig, updated_at: new Date().toISOString() }, { onConflict: 'guild_id,module' });
    setConfigs(prev => {
      const exists = prev.find(c => c.module === editingModule);
      if (exists) return prev.map(c => c.module === editingModule ? { ...c, config: editConfig } : c);
      return [...prev, { id: '', guild_id: guildId, module: editingModule, enabled: false, config: editConfig }];
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

  const editingModuleData = MODULES.find(m => m.key === editingModule);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white text-lg">🤖</div>
            <h1 className="text-2xl font-bold text-white">Bot Dashboard</h1>
          </div>
          <p className="text-gray-400 text-sm ml-12">Konfiguriere alle Bot-Module · Nur für {myUsername}</p>
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
          <input value={guildId} onChange={e => setGuildId(e.target.value)}
            placeholder="z.B. 123456789012345678"
            className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm font-mono focus:outline-none focus:border-blue-500" />
          <button onClick={saveGuildId}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition">
            Speichern
          </button>
        </div>
        <p className="text-gray-600 text-xs mt-2">Rechtsklick auf deinen Server → ID kopieren</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1a1d27] border border-white/10 rounded-xl p-1">
        <button onClick={() => setActiveTab('modules')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'modules' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          🧩 Module ({MODULES.length})
        </button>
        <button onClick={() => setActiveTab('logs')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
          📋 Bot Logs ({botLogs.length})
        </button>
      </div>

      {/* ══ MODULE ══ */}
      {activeTab === 'modules' && (
        <div className="space-y-3">
          {MODULES.map(module => {
            const cfg     = getConfig(module.key);
            const enabled = cfg?.enabled ?? false;
            return (
              <div key={module.key} className={`border rounded-2xl p-5 transition ${enabled ? module.color : 'border-white/10 bg-[#1a1d27]'}`}>
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
                    {module.fields.length > 0 && (
                      <button onClick={() => openEdit(module.key)}
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

                {/* Config Preview */}
                {enabled && cfg?.config && Object.keys(cfg.config).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-2">
                    {Object.entries(cfg.config).slice(0, 4).map(([k, v]) => {
                      if (typeof v === 'boolean') return null;
                      return (
                        <div key={k} className="bg-black/20 rounded-lg px-3 py-2">
                          <p className="text-gray-500 text-xs">{k.replace(/_/g, ' ')}</p>
                          <p className="text-gray-300 text-xs font-mono truncate">{String(v)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ LOGS ══ */}
      {activeTab === 'logs' && (
        <div className="space-y-2">
          {botLogs.length === 0 ? (
            <div className="text-center py-12 bg-[#1a1d27] border border-white/10 rounded-xl">
              <p className="text-3xl mb-2">📭</p>
              <p className="text-gray-400 text-sm">Keine Bot-Logs vorhanden</p>
            </div>
          ) : botLogs.map(log => (
            <div key={log.id} className="bg-[#1a1d27] border border-white/[0.07] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg flex-shrink-0">{ACTION_LABELS[log.action]?.split(' ')[0] || '📋'}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-sm font-semibold">{ACTION_LABELS[log.action] || log.action}</span>
                      {log.moderator_id && <span className="text-blue-400 text-xs font-mono">{log.moderator_id}</span>}
                      {log.target_id && <><span className="text-gray-600 text-xs">→</span><span className="text-purple-400 text-xs font-mono">{log.target_id}</span></>}
                    </div>
                    {log.reason && <p className="text-gray-500 text-xs mt-0.5">{log.reason}</p>}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <p className="text-gray-600 text-xs font-mono mt-0.5">{JSON.stringify(log.details)}</p>
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
      {editingModule && editingModuleData && (
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
              {editingModuleData.fields.map(field => (
                <div key={field.key}>
                  <label className="text-gray-400 text-xs mb-1.5 block font-medium">{field.label}</label>
                  {field.type === 'toggle' ? (
                    <button onClick={() => setEditConfig(p => ({ ...p, [field.key]: !p[field.key] }))}
                      className={`relative w-12 h-6 rounded-full transition-all ${editConfig[field.key] ? 'bg-blue-600' : 'bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${editConfig[field.key] ? 'left-6' : 'left-0.5'}`} />
                    </button>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={editConfig[field.key] || ''}
                      onChange={e => setEditConfig(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500 resize-none"
                    />
                  ) : (
                    <input
                      value={editConfig[field.key] || ''}
                      onChange={e => setEditConfig(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full bg-white/5 border border-white/[0.08] rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              ))}

              {/* Variables hint */}
              {editingModuleData.fields.some(f => f.type === 'textarea' || f.key === 'message') && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-blue-400 text-xs font-semibold mb-2">📝 Verfügbare Variablen:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['{user}', '{username}', '{server}', '{membercount}'].map(v => (
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
