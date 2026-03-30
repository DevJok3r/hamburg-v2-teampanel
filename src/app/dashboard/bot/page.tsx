'use client';

import { useState, useEffect, useRef } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const LOGO = 'https://cdn.discordapp.com/attachments/1289620593062187110/1484654302726328440/Hamburg_V2.png';

type Section = 'overview' | 'bot_settings' | 'moderation' | 'messages' | 'welcome' | 'leave' | 'tickets' | 'ticket_messages' | 'logging' | 'log_templates' | 'transcripts' | 'logs';

interface BotLog { id: string; action: string; moderator_id: string | null; target_id: string | null; reason: string | null; details: Record<string, any>; created_at: string; }
interface Transcript { id: string; channel_name: string; user_id: string; claimed_by: string | null; category: string; messages: any[]; closed_by: string | null; created_at: string; closed_at: string | null; }
interface TicketCategory { label: string; emoji: string; description: string; category_id: string; support_roles: string; color: string; message: string; }
interface LogTemplate { action: string; enabled: boolean; title: string; color: string; show_moderator: boolean; show_target: boolean; show_reason: boolean; }
interface BotInfo { id: string; username: string; avatar: string | null; banner: string | null; }

const ALL_LOG_ACTIONS = [
  { key: 'ban',               label: '🔨 Ban',                   category: 'Moderation',  defaultColor: '#ff0000', defaultTitle: '🔨 Benutzer gebannt' },
  { key: 'unban',             label: '✅ Unban',                 category: 'Moderation',  defaultColor: '#00ff00', defaultTitle: '✅ Benutzer entbannt' },
  { key: 'kick',              label: '👢 Kick',                  category: 'Moderation',  defaultColor: '#ff6600', defaultTitle: '👢 Benutzer gekickt' },
  { key: 'timeout',           label: '⏱️ Timeout',              category: 'Moderation',  defaultColor: '#ffaa00', defaultTitle: '⏱️ Timeout gegeben' },
  { key: 'untimeout',         label: '✅ Timeout aufgehoben',    category: 'Moderation',  defaultColor: '#00ffaa', defaultTitle: '✅ Timeout aufgehoben' },
  { key: 'warn',              label: '⚠️ Verwarnung',           category: 'Moderation',  defaultColor: '#ffff00', defaultTitle: '⚠️ Verwarnung ausgestellt' },
  { key: 'clearwarn',         label: '🗑️ Verwarnung gelöscht',  category: 'Moderation',  defaultColor: '#88ff88', defaultTitle: '🗑️ Verwarnung gelöscht' },
  { key: 'chatclear',         label: '🧹 Chatclear',            category: 'Moderation',  defaultColor: '#ff00ff', defaultTitle: '🧹 Chat geleert' },
  { key: 'role_add',          label: '➕ Rolle gegeben',         category: 'Moderation',  defaultColor: '#00ccff', defaultTitle: '➕ Rolle hinzugefügt' },
  { key: 'role_remove',       label: '➖ Rolle entfernt',        category: 'Moderation',  defaultColor: '#ff6666', defaultTitle: '➖ Rolle entfernt' },
  { key: 'lock',              label: '🔒 Kanal gesperrt',        category: 'Moderation',  defaultColor: '#ff4444', defaultTitle: '🔒 Kanal gesperrt' },
  { key: 'unlock',            label: '🔓 Kanal entsperrt',       category: 'Moderation',  defaultColor: '#44ff44', defaultTitle: '🔓 Kanal entsperrt' },
  { key: 'slowmode',          label: '🐌 Slowmode',              category: 'Moderation',  defaultColor: '#aaaaff', defaultTitle: '🐌 Slowmode gesetzt' },
  { key: 'member_join',       label: '📥 Member Join',           category: 'Mitglieder', defaultColor: '#00ff88', defaultTitle: '📥 Mitglied beigetreten' },
  { key: 'member_leave',      label: '📤 Member Leave',          category: 'Mitglieder', defaultColor: '#ff4400', defaultTitle: '📤 Mitglied verlassen' },
  { key: 'nick_change',       label: '✏️ Nickname geändert',    category: 'Mitglieder', defaultColor: '#ccccff', defaultTitle: '✏️ Nickname geändert' },
  { key: 'member_role_add',   label: '➕ Rolle via Event',       category: 'Mitglieder', defaultColor: '#00ccff', defaultTitle: '➕ Rolle hinzugefügt' },
  { key: 'member_role_remove',label: '➖ Rolle via Event',       category: 'Mitglieder', defaultColor: '#ff8888', defaultTitle: '➖ Rolle entfernt' },
  { key: 'message_delete',    label: '🗑️ Nachricht gelöscht',   category: 'Nachrichten', defaultColor: '#ff6666', defaultTitle: '🗑️ Nachricht gelöscht' },
  { key: 'message_edit',      label: '✏️ Nachricht bearbeitet', category: 'Nachrichten', defaultColor: '#ffcc00', defaultTitle: '✏️ Nachricht bearbeitet' },
  { key: 'voice_join',        label: '🔊 Voice beigetreten',     category: 'Voice',       defaultColor: '#00ff88', defaultTitle: '🔊 Voice beigetreten' },
  { key: 'voice_leave',       label: '🔇 Voice verlassen',       category: 'Voice',       defaultColor: '#ff4400', defaultTitle: '🔇 Voice verlassen' },
  { key: 'voice_move',        label: '🔀 Voice gewechselt',      category: 'Voice',       defaultColor: '#ffcc00', defaultTitle: '🔀 Voice gewechselt' },
  { key: 'ticket_open',       label: '🎫 Ticket geöffnet',       category: 'Tickets',     defaultColor: '#0099ff', defaultTitle: '🎫 Ticket geöffnet' },
  { key: 'ticket_close',      label: '🔒 Ticket geschlossen',    category: 'Tickets',     defaultColor: '#888888', defaultTitle: '🔒 Ticket geschlossen' },
  { key: 'ticket_claim',      label: '✋ Ticket übernommen',     category: 'Tickets',     defaultColor: '#00ffcc', defaultTitle: '✋ Ticket übernommen' },
];

const LOG_CATEGORIES = [...new Set(ALL_LOG_ACTIONS.map(a => a.category))];
const LOG_ICONS: Record<string, string> = { ban:'🔨', unban:'✅', kick:'👢', timeout:'⏱️', untimeout:'✅', warn:'⚠️', clearwarn:'🗑️', chatclear:'🧹', role_add:'➕', role_remove:'➖', lock:'🔒', unlock:'🔓', slowmode:'🐌', ticket_open:'🎫', ticket_close:'🔒', ticket_claim:'✋', member_join:'📥', member_leave:'📤', message_delete:'🗑️', message_edit:'✏️', voice_join:'🔊', voice_leave:'🔇', voice_move:'🔀', nick_change:'✏️', member_role_add:'➕', member_role_remove:'➖' };
const LOG_COLORS_CSS: Record<string, string> = { ban:'text-red-400', unban:'text-green-400', kick:'text-orange-400', timeout:'text-yellow-400', untimeout:'text-green-400', warn:'text-yellow-300', ticket_open:'text-blue-400', ticket_close:'text-gray-400', member_join:'text-green-400', member_leave:'text-orange-400', message_delete:'text-red-300' };

const WELCOME_VARS = ['{user}','{username}','{displayname}','{server}','{membercount}','{date}','{time}','{id}','{accountage}','{joined}','{tag}'];
const MSG_VARS = ['{reason}','{duration}','{server}','{moderator}','{moderator_id}','{count}','{category}'];

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${value ? 'bg-blue-600' : 'bg-white/10'}`}>
      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${value ? 'left-5' : 'left-0.5'}`} />
    </button>
  );
}

function Input({ label, value, onChange, placeholder, hint, mono, type = 'text' }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; mono?: boolean; type?: string }) {
  return (
    <div>
      {label && <label className="text-gray-400 text-xs font-medium mb-1.5 block">{label}</label>}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/70 transition ${mono ? 'font-mono' : ''}`} />
      {hint && <p className="text-gray-700 text-xs mt-1">{hint}</p>}
    </div>
  );
}

function RichEditor({ label, value, onChange, placeholder, rows = 4, vars }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; vars?: string[] }) {
  return (
    <div>
      {label && <label className="text-gray-400 text-xs font-medium mb-1.5 block">{label}</label>}
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/70 resize-y font-mono leading-relaxed transition" />
      <div className="flex items-center justify-between mt-1 gap-2">
        <p className="text-gray-700 text-xs flex-shrink-0">**fett** *kursiv* \n = neue Zeile</p>
        {vars && <div className="flex gap-1 flex-wrap justify-end">{vars.map(v => <span key={v} onClick={() => onChange(value + v)} className="text-blue-400 text-xs font-mono bg-blue-500/10 px-1.5 py-0.5 rounded cursor-pointer hover:bg-blue-500/20 transition">{v}</span>)}</div>}
      </div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-[#13151f] border border-white/[0.06] rounded-2xl p-6 ${className}`}>{children}</div>;
}

function SectionHeader({ title, desc, module, enabled, onToggle }: { title: string; desc: string; module?: string; enabled?: boolean; onToggle?: () => void }) {
  return (
    <div className="flex items-start justify-between">
      <div><h2 className="text-xl font-bold text-white">{title}</h2><p className="text-gray-500 text-sm mt-0.5">{desc}</p></div>
      {module && onToggle && <Toggle value={enabled ?? false} onChange={onToggle} />}
    </div>
  );
}

export default function BotDashboard() {
  const supabase = createClientSupabaseClient();
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [loading, setLoading]   = useState(true);
  const [guildId, setGuildId]   = useState('');
  const [section, setSection]   = useState<Section>('overview');
  const [configs, setConfigs]   = useState<Record<string, any>>({});
  const [logs, setLogs]         = useState<BotLog[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);
  const [logTemplates, setLogTemplates] = useState<Record<string, LogTemplate>>({});
  const [botInfo, setBotInfo]   = useState<BotInfo | null>(null);
  const [saving, setSaving]     = useState<string | null>(null);
  const [msg, setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  const [logFilter, setLogFilter] = useState('all');
  const [ticketCats, setTicketCats] = useState<TicketCategory[]>([]);
  const [logCatFilter, setLogCatFilter] = useState('all');

  // Bot settings state
  const [botUsername, setBotUsername]   = useState('');
  const [botAvatarUrl, setBotAvatarUrl] = useState('');
  const [savingBot, setSavingBot]       = useState<string | null>(null);
  const [botMsg, setBotMsg]             = useState<{ text: string; ok: boolean } | null>(null);

  // Module states
  const [welcome, setWelcome]     = useState<Record<string,any>>({});
  const [leave, setLeave]         = useState<Record<string,any>>({});
  const [tickets, setTickets]     = useState<Record<string,any>>({});
  const [logging, setLogging]     = useState<Record<string,any>>({});
  const [messages, setMessages]   = useState<Record<string,any>>({});
  const [ticketMsgs, setTicketMsgs] = useState<Record<string,any>>({});

  function showMsg(text: string, ok = true) { setMsg({ text, ok }); setTimeout(() => setMsg(null), 4000); }
  function showBotMsg(text: string, ok = true) { setBotMsg({ text, ok }); setTimeout(() => setBotMsg(null), 5000); }

  async function load(gid?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push('/dashboard');
    const { data: p } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    if (!p || p.username !== 'jxkerlds') return router.push('/dashboard');

    const savedGid = gid || localStorage.getItem('bot_guild_id') || '';
    setGuildId(savedGid);

    if (savedGid) {
      const [cfgRes, logsRes, txRes, tmplRes] = await Promise.all([
        supabase.from('bot_config').select('*').eq('guild_id', savedGid),
        supabase.from('bot_logs').select('*').eq('guild_id', savedGid).order('created_at', { ascending: false }).limit(200),
        supabase.from('bot_ticket_transcripts').select('*').eq('guild_id', savedGid).order('created_at', { ascending: false }).limit(50),
        supabase.from('bot_log_templates').select('*').eq('guild_id', savedGid),
      ]);

      const cfgMap: Record<string, any> = {};
      for (const c of cfgRes.data || []) cfgMap[c.module] = c;
      setConfigs(cfgMap);
      setLogs(logsRes.data || []);
      setTranscripts(txRes.data || []);

      const tmplMap: Record<string, LogTemplate> = {};
      for (const t of tmplRes.data || []) tmplMap[t.action] = t;
      setLogTemplates(tmplMap);

      const tc = cfgMap['tickets']?.config || {};
      setWelcome(cfgMap['welcome']?.config || {});
      setLeave(cfgMap['leave']?.config || {});
      setTickets(tc);
      setTicketCats(tc.categories || []);
      setLogging(cfgMap['logging']?.config || {});
      setMessages(cfgMap['messages']?.config || {});
      setTicketMsgs(cfgMap['ticket_messages']?.config || {});
    }
    setLoading(false);
  }

  async function fetchBotInfo() {
    try {
      const res  = await fetch('/api/bot/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_info' }) });
      const data = await res.json();
      if (data.error) { showBotMsg('❌ ' + data.error, false); return; }
      setBotInfo(data);
      setBotUsername(data.username);
    } catch { showBotMsg('❌ Verbindungsfehler', false); }
  }

  useEffect(() => { load(); fetchBotInfo(); }, []);

  function isEnabled(m: string) { return configs[m]?.enabled ?? false; }

  async function toggleModule(module: string) {
    if (!guildId) return showMsg('Guild ID eingeben!', false);
    const newEnabled = !isEnabled(module);
    await supabase.from('bot_config').upsert({ guild_id: guildId, module, enabled: newEnabled, config: configs[module]?.config || {}, updated_at: new Date().toISOString() }, { onConflict: 'guild_id,module' });
    await load(guildId);
    showMsg(newEnabled ? `✅ ${module} aktiviert` : `⚫ ${module} deaktiviert`);
  }

  async function saveModule(module: string, config: Record<string, any>) {
    if (!guildId) return showMsg('Guild ID eingeben!', false);
    setSaving(module);
    await supabase.from('bot_config').upsert({ guild_id: guildId, module, enabled: isEnabled(module), config, updated_at: new Date().toISOString() }, { onConflict: 'guild_id,module' });
    await load(guildId);
    setSaving(null);
    showMsg('✅ Gespeichert!');
  }

  async function saveGuildId() { localStorage.setItem('bot_guild_id', guildId); await load(guildId); showMsg('✅ Verbunden!'); }

  async function saveLogTemplate(action: string, template: Partial<LogTemplate>) {
    if (!guildId) return;
    await supabase.from('bot_log_templates').upsert({ guild_id: guildId, action, ...template }, { onConflict: 'guild_id,action' });
    setLogTemplates(p => ({ ...p, [action]: { ...getLogTemplate(action), ...template } }));
    showMsg('✅ Log-Template gespeichert!');
  }

  async function saveAllLogTemplates() {
    if (!guildId) return;
    setSaving('log_templates');
    for (const [action, tmpl] of Object.entries(logTemplates)) {
      await supabase.from('bot_log_templates').upsert({ guild_id: guildId, ...tmpl, action }, { onConflict: 'guild_id,action' });
    }
    setSaving(null);
    showMsg('✅ Alle Log-Templates gespeichert!');
  }

  function getLogTemplate(action: string): LogTemplate {
    const def = ALL_LOG_ACTIONS.find(a => a.key === action);
    return logTemplates[action] || {
      action, enabled: true,
      title: def?.defaultTitle || action,
      color: def?.defaultColor || '#5865f2',
      show_moderator: true, show_target: true, show_reason: true,
    };
  }

  function updateLogTemplate(action: string, key: string, value: any) {
    setLogTemplates(p => ({ ...p, [action]: { ...getLogTemplate(action), [key]: value } }));
  }

  // Bot settings actions
  async function setBotUsernameAction() {
    setSavingBot('username');
    const res  = await fetch('/api/bot/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_username', value: botUsername }) });
    const data = await res.json();
    setSavingBot(null);
    if (data.error) showBotMsg('❌ ' + data.error, false);
    else { showBotMsg('✅ Username geändert!'); fetchBotInfo(); }
  }

  async function setBotAvatarFromUrl() {
    if (!botAvatarUrl) return;
    setSavingBot('avatar');
    try {
      const imgRes = await fetch(botAvatarUrl);
      const blob   = await imgRes.blob();
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      const res  = await fetch('/api/bot/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_avatar', value: base64 }) });
      const data = await res.json();
      if (data.error) showBotMsg('❌ ' + data.error, false);
      else { showBotMsg('✅ Avatar geändert!'); fetchBotInfo(); }
    } catch { showBotMsg('❌ Fehler beim Laden des Bildes', false); }
    setSavingBot(null);
  }

  async function setBotAvatarFromFile(file: File) {
    setSavingBot('avatar');
    const base64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
    const res  = await fetch('/api/bot/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'set_avatar', value: base64 }) });
    const data = await res.json();
    setSavingBot(null);
    if (data.error) showBotMsg('❌ ' + data.error, false);
    else { showBotMsg('✅ Avatar geändert!'); fetchBotInfo(); }
  }

  const filteredLogs = logs.filter(l => logFilter === 'all' || l.action.startsWith(logFilter));
  const filteredLogActions = logCatFilter === 'all' ? ALL_LOG_ACTIONS : ALL_LOG_ACTIONS.filter(a => a.category === logCatFilter);

  const NAV: { key: Section; label: string; icon: string; count?: number; divider?: boolean }[] = [
    { key: 'overview',        label: 'Übersicht',          icon: '🏠' },
    { key: 'bot_settings',    label: 'Bot Einstellungen',  icon: '🤖', divider: true },
    { key: 'moderation',      label: 'Moderation',         icon: '🛡️' },
    { key: 'messages',        label: 'DM Nachrichten',     icon: '✉️' },
    { key: 'welcome',         label: 'Willkommen',         icon: '👋' },
    { key: 'leave',           label: 'Abschied',           icon: '📤' },
    { key: 'tickets',         label: 'Tickets',            icon: '🎫', divider: true },
    { key: 'ticket_messages', label: 'Ticket Nachrichten', icon: '💬' },
    { key: 'logging',         label: 'Logging',            icon: '📋', divider: true },
    { key: 'log_templates',   label: 'Log Templates',      icon: '🎨' },
    { key: 'transcripts',     label: 'Transcripts',        icon: '📜', count: transcripts.length },
    { key: 'logs',            label: 'Bot Logs',           icon: '📊', count: logs.length },
  ];

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center space-y-4">
        <img src={LOGO} className="w-16 h-16 rounded-2xl mx-auto animate-pulse" />
        <p className="text-gray-400 text-sm">Lade Bot Dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="flex gap-6 max-w-7xl">
      {/* Sidebar */}
      <div className="w-56 flex-shrink-0">
        <div className="sticky top-6 space-y-0.5">
          <div className="flex items-center gap-3 px-3 py-4 mb-2">
            {botInfo?.avatar ? <img src={botInfo.avatar} className="w-9 h-9 rounded-xl flex-shrink-0" /> : <img src={LOGO} className="w-9 h-9 rounded-xl flex-shrink-0" />}
            <div><p className="text-white font-bold text-sm">{botInfo?.username || 'Hamburg V2'}</p><p className="text-gray-600 text-xs">Bot Dashboard</p></div>
          </div>
          {NAV.map(n => (
            <div key={n.key}>
              {n.divider && <div className="border-t border-white/[0.05] my-1.5" />}
              <button onClick={() => setSection(n.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition ${section === n.key ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]'}`}>
                <span className="text-base flex-shrink-0">{n.icon}</span>
                <span className="flex-1 text-left text-xs">{n.label}</span>
                {n.count !== undefined && n.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${section === n.key ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-gray-600'}`}>{n.count}</span>
                )}
              </button>
            </div>
          ))}
          <div className="mt-3 px-3 pt-3 border-t border-white/[0.05]">
            <p className="text-gray-700 text-xs uppercase tracking-wider mb-2">Status</p>
            {['moderation','welcome','leave','tickets','logging'].map(m => (
              <div key={m} className="flex items-center justify-between py-0.5">
                <span className="text-gray-600 text-xs capitalize">{m}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${isEnabled(m) ? 'bg-green-400' : 'bg-gray-700'}`} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-6">
        {msg && <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl text-sm font-medium border shadow-2xl backdrop-blur-sm ${msg.ok ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>{msg.text}</div>}

        {/* ── OVERVIEW ── */}
        {section === 'overview' && (
          <div className="space-y-6">
            <div><h1 className="text-2xl font-bold text-white">Bot Dashboard</h1><p className="text-gray-500 text-sm mt-1">Vollständige Kontrolle über Hamburg V2 Bot</p></div>
            <Card>
              <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider mb-3">Discord Server ID</p>
              <div className="flex gap-2">
                <input value={guildId} onChange={e => setGuildId(e.target.value)} placeholder="123456789012345678"
                  className="flex-1 bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm font-mono focus:outline-none focus:border-blue-500/70 transition" />
                <button onClick={saveGuildId} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">Verbinden</button>
              </div>
            </Card>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Bot Logs',    value: logs.length,          color: 'text-blue-400',   border: 'border-blue-500/20' },
                { label: 'Transcripts', value: transcripts.length,   color: 'text-purple-400', border: 'border-purple-500/20' },
                { label: 'Aktive Module', value: ['moderation','welcome','leave','tickets','logging'].filter(m => isEnabled(m)).length, color: 'text-green-400', border: 'border-green-500/20' },
                { label: 'Log Templates', value: Object.keys(logTemplates).length, color: 'text-yellow-400', border: 'border-yellow-500/20' },
              ].map(s => (
                <Card key={s.label} className={`border ${s.border} text-center py-4`}>
                  <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-gray-600 text-xs mt-1">{s.label}</p>
                </Card>
              ))}
            </div>
            <Card>
              <p className="text-white font-semibold mb-4">🧩 Module</p>
              <div className="space-y-2">
                {[
                  { key: 'moderation', label: 'Moderation', desc: 'Ban, Kick, Timeout, Warn, Lock, Slowmode', icon: '🛡️', s: 'moderation' as Section },
                  { key: 'welcome',    label: 'Willkommen', desc: 'Willkommensnachrichten & Auto-Rollen',      icon: '👋', s: 'welcome' as Section },
                  { key: 'leave',      label: 'Abschied',   desc: 'Nachrichten beim Verlassen',                icon: '📤', s: 'leave' as Section },
                  { key: 'tickets',    label: 'Tickets',    desc: 'Support Tickets mit Kategorien',            icon: '🎫', s: 'tickets' as Section },
                  { key: 'logging',    label: 'Logging',    desc: 'Auto-Logging in Discord Kanäle',           icon: '📋', s: 'logging' as Section },
                ].map(m => (
                  <div key={m.key} className="flex items-center gap-3 bg-[#0d0e14] rounded-xl px-4 py-3">
                    <span className="text-xl">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2"><p className="text-white text-sm font-medium">{m.label}</p><span className={`text-xs px-1.5 py-0.5 rounded-full ${isEnabled(m.key) ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-600'}`}>{isEnabled(m.key) ? '● Aktiv' : '○ Inaktiv'}</span></div>
                      <p className="text-gray-600 text-xs">{m.desc}</p>
                    </div>
                    <button onClick={() => setSection(m.s)} className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 transition">→</button>
                    <Toggle value={isEnabled(m.key)} onChange={() => toggleModule(m.key)} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── BOT SETTINGS ── */}
        {section === 'bot_settings' && (
          <div className="space-y-6">
            <SectionHeader title="🤖 Bot Einstellungen" desc="Name, Profilbild und mehr direkt ändern" />

            {botMsg && <div className={`px-4 py-3 rounded-xl text-sm font-medium border ${botMsg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>{botMsg.text}</div>}

            {/* Bot Info */}
            {botInfo && (
              <Card>
                <div className="flex items-center gap-5">
                  {botInfo.avatar ? (
                    <img src={botInfo.avatar} className="w-20 h-20 rounded-2xl border-2 border-white/10" />
                  ) : (
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-3xl">🤖</div>
                  )}
                  <div>
                    <p className="text-white text-xl font-bold">{botInfo.username}</p>
                    <p className="text-gray-500 text-sm">ID: {botInfo.id}</p>
                    <p className="text-gray-600 text-xs mt-1">Bot Account</p>
                  </div>
                  <button onClick={fetchBotInfo} className="ml-auto text-gray-500 hover:text-white text-xs px-3 py-1.5 rounded-lg bg-white/5 transition">🔄 Aktualisieren</button>
                </div>
              </Card>
            )}

            {/* Username */}
            <Card>
              <p className="text-white font-semibold mb-4">📝 Bot Username ändern</p>
              <div className="flex gap-2">
                <input value={botUsername} onChange={e => setBotUsername(e.target.value)} placeholder="Neuer Username..."
                  className="flex-1 bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/70 transition" />
                <button onClick={setBotUsernameAction} disabled={savingBot === 'username' || !botUsername.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">
                  {savingBot === 'username' ? '⏳...' : '💾 Ändern'}
                </button>
              </div>
              <p className="text-gray-700 text-xs mt-2">⚠️ Discord limitiert Username-Änderungen. Nicht zu oft ändern!</p>
            </Card>

            {/* Avatar */}
            <Card>
              <p className="text-white font-semibold mb-4">🖼️ Bot Avatar ändern</p>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-400 text-xs mb-2">Option 1: URL eingeben</p>
                  <div className="flex gap-2">
                    <input value={botAvatarUrl} onChange={e => setBotAvatarUrl(e.target.value)} placeholder="https://... (PNG, JPG, GIF)"
                      className="flex-1 bg-[#0d0e14] border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/70 transition" />
                    <button onClick={setBotAvatarFromUrl} disabled={savingBot === 'avatar' || !botAvatarUrl}
                      className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">
                      {savingBot === 'avatar' ? '⏳...' : 'Setzen'}
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-xs mb-2">Option 2: Datei hochladen</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) setBotAvatarFromFile(e.target.files[0]); }} />
                  <button onClick={() => fileRef.current?.click()} disabled={savingBot === 'avatar'}
                    className="bg-white/5 hover:bg-white/10 disabled:opacity-40 border border-white/10 text-gray-300 font-medium px-5 py-2.5 rounded-xl text-sm transition">
                    {savingBot === 'avatar' ? '⏳ Wird hochgeladen...' : '📁 Datei auswählen'}
                  </button>
                </div>
              </div>
              <p className="text-gray-700 text-xs mt-3">⚠️ Avatar-Änderungen sind ebenfalls limitiert. Max. einige Male pro Tag.</p>
            </Card>
          </div>
        )}

        {/* ── MODERATION ── */}
        {section === 'moderation' && (
          <div className="space-y-6">
            <SectionHeader title="🛡️ Moderation" desc="Alle Moderations-Commands" module="moderation" enabled={isEnabled('moderation')} onToggle={() => toggleModule('moderation')} />
            <Card>
              <p className="text-gray-400 text-sm mb-4">Aktiviert alle Moderationsbefehle. DM-Nachrichten → <button onClick={() => setSection('messages')} className="text-blue-400 underline">DM Nachrichten</button></p>
              <div className="grid grid-cols-3 gap-2">
                {['/ban','/unban','/kick','/timeout','/untimeout','/warn','/warnings','/clearwarn','/clearallwarns','/chatclear','/role','/lock','/unlock','/slowmode','/embed','/say','/userinfo','/serverinfo','/avatar','/banner','/ping','/botinfo','/membercount','/ticket','/closeticket','/adduser','/removeuser'].map(c => (
                  <div key={c} className="bg-[#0d0e14] rounded-lg px-3 py-2 text-gray-500 text-xs font-mono">{c}</div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── DM NACHRICHTEN ── */}
        {section === 'messages' && (
          <div className="space-y-6">
            <SectionHeader title="✉️ DM Nachrichten" desc="Nachrichten die Benutzer per DM erhalten" />
            <Card>
              <div className="space-y-5">
                {[
                  { key: 'ban',       label: '🔨 Ban DM',           def: 'Du wurdest von **{server}** gebannt.\n\n**Grund:** {reason}' },
                  { key: 'kick',      label: '👢 Kick DM',          def: 'Du wurdest von **{server}** gekickt.\n\n**Grund:** {reason}' },
                  { key: 'timeout',   label: '⏱️ Timeout DM',      def: 'Du hast einen Timeout auf **{server}** erhalten.\n\n**Dauer:** {duration} Minuten\n**Grund:** {reason}' },
                  { key: 'untimeout', label: '✅ Timeout aufgehoben',def: 'Dein Timeout auf **{server}** wurde aufgehoben.' },
                  { key: 'warn',      label: '⚠️ Verwarnung DM',   def: 'Du hast eine Verwarnung auf **{server}** erhalten.\n\n**Grund:** {reason}\n**Gesamt:** {count}' },
                  { key: 'lock_msg',  label: '🔒 Lock Nachricht',   def: '🔒 Dieser Kanal wurde gesperrt.\n\n**Grund:** {reason}' },
                  { key: 'unlock_msg',label: '🔓 Unlock Nachricht', def: '🔓 Dieser Kanal wurde entsperrt.' },
                ].map(f => (
                  <div key={f.key} className="bg-[#0d0e14] rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-gray-300 text-sm font-medium">{f.label}</p>
                      {['ban','kick','timeout','untimeout','warn'].includes(f.key) && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Toggle value={messages[f.key+'_enabled'] !== false} onChange={v => setMessages(p => ({...p, [f.key+'_enabled']: v}))} />
                          <span className="text-gray-600 text-xs">DM senden</span>
                        </label>
                      )}
                    </div>
                    <RichEditor value={messages[f.key] || ''} onChange={v => setMessages(p => ({...p, [f.key]: v}))} placeholder={f.def} rows={3} vars={MSG_VARS} />
                  </div>
                ))}
              </div>
              <button onClick={() => saveModule('messages', messages)} disabled={saving === 'messages'} className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
                {saving === 'messages' ? '⏳...' : '💾 DM Nachrichten speichern'}
              </button>
            </Card>
          </div>
        )}

        {/* ── WELCOME ── */}
        {section === 'welcome' && (
          <div className="space-y-6">
            <SectionHeader title="👋 Willkommen" desc="Nachrichten wenn neue Mitglieder beitreten" module="welcome" enabled={isEnabled('welcome')} onToggle={() => toggleModule('welcome')} />
            <Card>
              <div className="space-y-4">
                <Input label="📢 Kanal ID" value={welcome.channel_id || ''} onChange={v => setWelcome(p => ({...p, channel_id: v}))} placeholder="123456789..." />
                <Input label="📝 Titel" value={welcome.title || ''} onChange={v => setWelcome(p => ({...p, title: v}))} placeholder="👋 Willkommen auf {server}!" />
                <RichEditor label="💬 Nachricht" value={welcome.message || ''} onChange={v => setWelcome(p => ({...p, message: v}))} placeholder={'Willkommen {user}!\nDu bist Mitglied **#{membercount}**.'} rows={5} vars={WELCOME_VARS} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="🎨 Farbe" value={welcome.color || ''} onChange={v => setWelcome(p => ({...p, color: v}))} placeholder="#5865f2" />
                  <Input label="📝 Footer" value={welcome.footer || ''} onChange={v => setWelcome(p => ({...p, footer: v}))} placeholder="Hamburg V2 · {membercount} Mitglieder" />
                  <Input label="🖼️ Banner URL" value={welcome.image || ''} onChange={v => setWelcome(p => ({...p, image: v}))} placeholder="https://..." />
                  <Input label="🎭 Auto-Rollen IDs" value={welcome.auto_role || ''} onChange={v => setWelcome(p => ({...p, auto_role: v}))} placeholder="123456, 456789" hint="Kommagetrennt" />
                  <Input label="Feld 1 – Name" value={welcome.field_1_name || ''} onChange={v => setWelcome(p => ({...p, field_1_name: v}))} placeholder="📅 Beigetreten" />
                  <Input label="Feld 1 – Wert" value={welcome.field_1_value || ''} onChange={v => setWelcome(p => ({...p, field_1_value: v}))} placeholder="{joined}" />
                  <Input label="Feld 2 – Name" value={welcome.field_2_name || ''} onChange={v => setWelcome(p => ({...p, field_2_name: v}))} placeholder="📆 Account" />
                  <Input label="Feld 2 – Wert" value={welcome.field_2_value || ''} onChange={v => setWelcome(p => ({...p, field_2_value: v}))} placeholder="{accountage}" />
                  <Input label="Feld 3 – Name" value={welcome.field_3_name || ''} onChange={v => setWelcome(p => ({...p, field_3_name: v}))} placeholder="🆔 ID" />
                  <Input label="Feld 3 – Wert" value={welcome.field_3_value || ''} onChange={v => setWelcome(p => ({...p, field_3_value: v}))} placeholder="{id}" />
                </div>
                <RichEditor label="📨 DM beim Beitritt" value={welcome.dm_message || ''} onChange={v => setWelcome(p => ({...p, dm_message: v}))} placeholder="Willkommen auf {server}!" rows={3} vars={WELCOME_VARS} />
                <div className="flex flex-wrap gap-5">
                  {[['embed','Als Embed'],['thumbnail','Avatar Thumbnail'],['ping_user','User pingen'],['show_logo','Logo im Author']].map(([k,l]) => (
                    <label key={k} className="flex items-center gap-2 cursor-pointer"><Toggle value={!!welcome[k]} onChange={v => setWelcome(p => ({...p, [k]: v}))} /><span className="text-gray-300 text-sm">{l}</span></label>
                  ))}
                </div>
              </div>
              <button onClick={() => saveModule('welcome', welcome)} disabled={saving === 'welcome'} className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
                {saving === 'welcome' ? '⏳...' : '💾 Willkommen speichern'}
              </button>
            </Card>
          </div>
        )}

        {/* ── LEAVE ── */}
        {section === 'leave' && (
          <div className="space-y-6">
            <SectionHeader title="📤 Abschied" desc="Nachrichten wenn Mitglieder den Server verlassen" module="leave" enabled={isEnabled('leave')} onToggle={() => toggleModule('leave')} />
            <Card>
              <div className="space-y-4">
                <Input label="📢 Kanal ID" value={leave.channel_id || ''} onChange={v => setLeave(p => ({...p, channel_id: v}))} placeholder="123456789..." />
                <Input label="📝 Titel" value={leave.title || ''} onChange={v => setLeave(p => ({...p, title: v}))} placeholder="👋 Auf Wiedersehen!" />
                <RichEditor label="💬 Nachricht" value={leave.message || ''} onChange={v => setLeave(p => ({...p, message: v}))} placeholder={'**{username}** hat den Server verlassen.'} rows={4} vars={WELCOME_VARS} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="🎨 Farbe" value={leave.color || ''} onChange={v => setLeave(p => ({...p, color: v}))} placeholder="#ff4444" />
                  <Input label="📝 Footer" value={leave.footer || ''} onChange={v => setLeave(p => ({...p, footer: v}))} placeholder="Hamburg V2" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer"><Toggle value={leave.embed !== false} onChange={v => setLeave(p => ({...p, embed: v}))} /><span className="text-gray-300 text-sm">Als Embed</span></label>
              </div>
              <button onClick={() => saveModule('leave', leave)} disabled={saving === 'leave'} className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
                {saving === 'leave' ? '⏳...' : '💾 Abschied speichern'}
              </button>
            </Card>
          </div>
        )}

        {/* ── TICKETS ── */}
        {section === 'tickets' && (
          <div className="space-y-6">
            <SectionHeader title="🎫 Ticket System" desc="Support Tickets mit Kategorien & Transcripts" module="tickets" enabled={isEnabled('tickets')} onToggle={() => toggleModule('tickets')} />
            <Card>
              <p className="text-white font-semibold mb-4">⚙️ Globale Einstellungen</p>
              <div className="space-y-4">
                <Input label="📝 Panel Titel" value={tickets.panel_title || ''} onChange={v => setTickets(p => ({...p, panel_title: v}))} placeholder="🎫 Support Ticket" />
                <RichEditor label="💬 Panel Beschreibung" value={tickets.panel_description || ''} onChange={v => setTickets(p => ({...p, panel_description: v}))} placeholder={'Wähle eine Kategorie.\n\n**Regeln:**\n• Sei respektvoll'} rows={6} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="🎨 Farbe" value={tickets.color || ''} onChange={v => setTickets(p => ({...p, color: v}))} placeholder="#5865f2" />
                  <Input label="📁 Select Platzhalter" value={tickets.select_placeholder || ''} onChange={v => setTickets(p => ({...p, select_placeholder: v}))} placeholder="📁 Kategorie wählen..." />
                  <Input label="🖼️ Panel Banner" value={tickets.panel_image || ''} onChange={v => setTickets(p => ({...p, panel_image: v}))} placeholder="https://..." />
                  <Input label="🖼️ Panel Thumbnail" value={tickets.panel_thumbnail || ''} onChange={v => setTickets(p => ({...p, panel_thumbnail: v}))} placeholder="https://..." />
                  <Input label="📝 Footer" value={tickets.footer || ''} onChange={v => setTickets(p => ({...p, footer: v}))} placeholder="Hamburg V2 Support" />
                  <Input label="📢 Standard Kategorie ID" value={tickets.category_id || ''} onChange={v => setTickets(p => ({...p, category_id: v}))} placeholder="123456789..." />
                  <Input label="🎭 Support Rollen IDs" value={tickets.support_roles || ''} onChange={v => setTickets(p => ({...p, support_roles: v}))} placeholder="123456, 789012" hint="Kommagetrennt" />
                  <Input label="🔢 Ticket-Limit" value={String(tickets.ticket_limit || 1)} onChange={v => setTickets(p => ({...p, ticket_limit: parseInt(v) || 1}))} placeholder="1" hint="Max Tickets pro User" />
                  <Input label="👑 VIP User IDs" value={tickets.vip_ids || ''} onChange={v => setTickets(p => ({...p, vip_ids: v}))} placeholder="123456, 789012" hint="Unbegrenzte Tickets" />
                </div>
                <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Button Beschriftungen</p>
                <div className="grid grid-cols-3 gap-3">
                  <Input label="🔒 Schließen" value={tickets.close_button_label || ''} onChange={v => setTickets(p => ({...p, close_button_label: v}))} placeholder="🔒 Schließen" />
                  <Input label="✋ Übernehmen" value={tickets.claim_button_label || ''} onChange={v => setTickets(p => ({...p, claim_button_label: v}))} placeholder="✋ Übernehmen" />
                  <Input label="📁 Weiterleiten" value={tickets.forward_button_label || ''} onChange={v => setTickets(p => ({...p, forward_button_label: v}))} placeholder="📁 Weiterleiten" />
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div><p className="text-white font-semibold">📁 Kategorien ({ticketCats.length})</p><p className="text-gray-600 text-xs mt-0.5">Bis zu 25</p></div>
                <button onClick={() => setTicketCats(p => [...p, { label: 'Neue Kategorie', emoji: '🎫', description: '', category_id: '', support_roles: '', color: '#5865f2', message: '' }])}
                  className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs px-3 py-2 rounded-xl transition">+ Hinzufügen</button>
              </div>
              {ticketCats.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-white/10 rounded-xl"><p className="text-gray-600 text-sm">Keine Kategorien</p></div>
              ) : (
                <div className="space-y-3">
                  {ticketCats.map((cat, idx) => (
                    <div key={idx} className="bg-[#0d0e14] border border-white/[0.05] rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2"><span>{cat.emoji || '🎫'}</span><span className="text-white text-sm font-medium">{cat.label}</span></div>
                        <div className="flex gap-1">
                          {idx > 0 && <button onClick={() => { const n=[...ticketCats];[n[idx],n[idx-1]]=[n[idx-1],n[idx]];setTicketCats(n); }} className="text-gray-600 hover:text-white text-xs px-2 py-1 rounded">↑</button>}
                          {idx<ticketCats.length-1 && <button onClick={() => { const n=[...ticketCats];[n[idx],n[idx+1]]=[n[idx+1],n[idx]];setTicketCats(n); }} className="text-gray-600 hover:text-white text-xs px-2 py-1 rounded">↓</button>}
                          <button onClick={() => setTicketCats(p=>p.filter((_,i)=>i!==idx))} className="text-red-500 hover:text-red-300 text-xs px-2 py-1 rounded">✕</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[{k:'label',l:'Name',p:'Allgemeiner Support'},{k:'emoji',l:'Emoji',p:'🎫'},{k:'description',l:'Kurzbeschreibung',p:'...'},{k:'color',l:'Farbe',p:'#5865f2'},{k:'category_id',l:'Kategorie ID',p:'123456...'},{k:'support_roles',l:'Support Rollen',p:'123456, 789012'}].map(f=>(
                          <div key={f.k}><label className="text-gray-600 text-xs mb-1 block">{f.l}</label><input value={(cat as any)[f.k]||''} onChange={e=>{const n=[...ticketCats];(n[idx] as any)[f.k]=e.target.value;setTicketCats(n);}} placeholder={f.p} className="w-full bg-[#13151f] border border-white/[0.05] rounded-lg px-3 py-2 text-white placeholder-gray-700 text-xs focus:outline-none focus:border-blue-500/50 transition"/></div>
                        ))}
                        <div className="col-span-2"><label className="text-gray-600 text-xs mb-1 block">Ticket Nachricht</label><textarea value={cat.message||''} onChange={e=>{const n=[...ticketCats];n[idx].message=e.target.value;setTicketCats(n);}} placeholder={'Hallo {user}!\nWir kümmern uns bald.'} rows={2} className="w-full bg-[#13151f] border border-white/[0.05] rounded-lg px-3 py-2 text-white placeholder-gray-700 text-xs focus:outline-none focus:border-blue-500/50 resize-none font-mono transition"/></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <button onClick={() => saveModule('tickets', { ...tickets, categories: ticketCats })} disabled={saving === 'tickets'} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
              {saving === 'tickets' ? '⏳...' : '💾 Ticket System speichern'}
            </button>
          </div>
        )}

        {/* ── TICKET NACHRICHTEN ── */}
        {section === 'ticket_messages' && (
          <div className="space-y-6">
            <SectionHeader title="💬 Ticket Nachrichten" desc="Alle Nachrichten die im Ticket System erscheinen" />
            <Card>
              <div className="space-y-4">
                {[
                  { key: 'ticket_open',    label: '🎫 Ticket geöffnet (Standard)',   def: 'Hallo {user}!\n\nDas Support-Team wird sich bald bei dir melden.\nBitte beschreibe dein Anliegen so genau wie möglich.' },
                  { key: 'ticket_close',   label: '🔒 Ticket geschlossen',           def: 'Ticket geschlossen von <@{moderator_id}>.\nKanal wird in **5 Sekunden** gelöscht.' },
                  { key: 'ticket_claim',   label: '✋ Ticket übernommen',            def: '<@{moderator_id}> hat das Ticket übernommen. Nochmal drücken zum Abgeben.' },
                  { key: 'ticket_unclaim', label: '↩️ Ticket abgegeben',             def: '<@{moderator_id}> hat das Ticket abgegeben.' },
                  { key: 'ticket_forward', label: '📁 Ticket weitergeleitet',        def: 'Ticket weitergeleitet an **{category}** von <@{moderator_id}>.' },
                ].map(f => (
                  <div key={f.key} className="bg-[#0d0e14] rounded-xl p-4">
                    <p className="text-gray-300 text-sm font-medium mb-2">{f.label}</p>
                    <RichEditor value={ticketMsgs[f.key]||''} onChange={v=>setTicketMsgs(p=>({...p,[f.key]:v}))} placeholder={f.def} rows={3} vars={[...MSG_VARS,'{category}','{moderator_id}']} />
                  </div>
                ))}
              </div>
              <button onClick={() => saveModule('ticket_messages', ticketMsgs)} disabled={saving === 'ticket_messages'} className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
                {saving === 'ticket_messages' ? '⏳...' : '💾 Ticket Nachrichten speichern'}
              </button>
            </Card>
          </div>
        )}

        {/* ── LOGGING ── */}
        {section === 'logging' && (
          <div className="space-y-6">
            <SectionHeader title="📋 Logging" desc="Automatisches Logging aller Aktionen" module="logging" enabled={isEnabled('logging')} onToggle={() => toggleModule('logging')} />
            <Card>
              <div className="space-y-4">
                <Input label="📢 Haupt-Log Kanal ID" value={logging.channel_id||''} onChange={v=>setLogging(p=>({...p,channel_id:v}))} placeholder="123456789..." hint="Fallback wenn kein spezifischer Kanal" />
                <div className="border-t border-white/[0.06] pt-4 space-y-3">
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Spezifische Kanäle (optional)</p>
                  {[{key:'mod_channel',l:'🛡️ Mod-Logs',h:'Ban, Kick, Timeout, Warn'},{key:'member_channel',l:'👤 Member-Logs',h:'Join, Leave, Nickname'},{key:'msg_channel',l:'💬 Message-Logs',h:'Gelöscht, Bearbeitet'},{key:'voice_channel',l:'🔊 Voice-Logs',h:'Join, Leave, Move'},{key:'ticket_channel',l:'🎫 Ticket-Logs',h:'Geöffnet, Geschlossen'}].map(f=>(
                    <div key={f.key} className="flex items-center gap-3">
                      <div className="w-44 flex-shrink-0"><p className="text-gray-300 text-sm">{f.l}</p><p className="text-gray-600 text-xs">{f.h}</p></div>
                      <input value={(logging as any)[f.key]||''} onChange={e=>setLogging(p=>({...p,[f.key]:e.target.value}))} placeholder="Kanal ID..." className="flex-1 bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-700 text-sm font-mono focus:outline-none focus:border-blue-500/50 transition"/>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => saveModule('logging', logging)} disabled={saving === 'logging'} className="mt-6 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl text-sm transition">
                {saving === 'logging' ? '⏳...' : '💾 Logging speichern'}
              </button>
            </Card>
          </div>
        )}

        {/* ── LOG TEMPLATES ── */}
        {section === 'log_templates' && (
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div><h2 className="text-xl font-bold text-white">🎨 Log Templates</h2><p className="text-gray-500 text-sm mt-0.5">Jede Log-Nachricht individuell konfigurieren</p></div>
              <button onClick={saveAllLogTemplates} disabled={saving === 'log_templates'} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-xl text-sm transition">
                {saving === 'log_templates' ? '⏳...' : '💾 Alle speichern'}
              </button>
            </div>

            {/* Category Filter */}
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setLogCatFilter('all')} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${logCatFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}>Alle ({ALL_LOG_ACTIONS.length})</button>
              {LOG_CATEGORIES.map(cat => (
                <button key={cat} onClick={() => setLogCatFilter(cat)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${logCatFilter === cat ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}>
                  {cat} ({ALL_LOG_ACTIONS.filter(a => a.category === cat).length})
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredLogActions.map(action => {
                const tmpl = getLogTemplate(action.key);
                return (
                  <Card key={action.key}>
                    <div className="flex items-start gap-4">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{LOG_ICONS[action.key] || '📋'}</span>
                          <div>
                            <p className="text-white font-medium text-sm">{action.label}</p>
                            <p className="text-gray-600 text-xs">{action.category}</p>
                          </div>
                          <div className="ml-auto flex items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer"><Toggle value={tmpl.enabled} onChange={v => updateLogTemplate(action.key, 'enabled', v)} /><span className="text-gray-500 text-xs">Aktiv</span></label>
                          </div>
                        </div>
                        {tmpl.enabled && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-gray-500 text-xs mb-1 block">📝 Titel</label>
                              <input value={tmpl.title} onChange={e => updateLogTemplate(action.key, 'title', e.target.value)} placeholder={action.defaultTitle}
                                className="w-full bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-700 text-sm focus:outline-none focus:border-blue-500/50 transition" />
                            </div>
                            <div>
                              <label className="text-gray-500 text-xs mb-1 block">🎨 Farbe (Hex)</label>
                              <div className="flex gap-2">
                                <input value={tmpl.color} onChange={e => updateLogTemplate(action.key, 'color', e.target.value)} placeholder={action.defaultColor}
                                  className="flex-1 bg-[#0d0e14] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-700 text-sm font-mono focus:outline-none focus:border-blue-500/50 transition" />
                                <div className="w-10 h-10 rounded-xl border border-white/10 flex-shrink-0" style={{ backgroundColor: tmpl.color || action.defaultColor }} />
                              </div>
                            </div>
                            <div className="col-span-2 flex gap-5">
                              <label className="flex items-center gap-2 cursor-pointer"><Toggle value={tmpl.show_moderator} onChange={v => updateLogTemplate(action.key, 'show_moderator', v)} /><span className="text-gray-400 text-xs">Moderator anzeigen</span></label>
                              <label className="flex items-center gap-2 cursor-pointer"><Toggle value={tmpl.show_target} onChange={v => updateLogTemplate(action.key, 'show_target', v)} /><span className="text-gray-400 text-xs">Ziel-User anzeigen</span></label>
                              <label className="flex items-center gap-2 cursor-pointer"><Toggle value={tmpl.show_reason} onChange={v => updateLogTemplate(action.key, 'show_reason', v)} /><span className="text-gray-400 text-xs">Grund anzeigen</span></label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TRANSCRIPTS ── */}
        {section === 'transcripts' && (
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold text-white">📜 Ticket Transcripts</h2><p className="text-gray-500 text-sm mt-0.5">{transcripts.length} Transcripts</p></div>
            {selectedTranscript ? (
              <Card>
                <div className="flex items-center justify-between mb-5">
                  <div><p className="text-white font-semibold">#{selectedTranscript.channel_name}</p><p className="text-gray-500 text-xs mt-0.5">{selectedTranscript.category} · {selectedTranscript.messages.length} Nachrichten · {new Date(selectedTranscript.created_at).toLocaleString('de-DE')}</p></div>
                  <button onClick={() => setSelectedTranscript(null)} className="text-gray-500 hover:text-white text-sm px-3 py-1.5 rounded-lg bg-white/5 transition">← Zurück</button>
                </div>
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                  {selectedTranscript.messages.map((m: any, idx: number) => (
                    <div key={idx} className="flex gap-3 bg-[#0d0e14] rounded-xl px-4 py-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{m.author?.charAt(0)?.toUpperCase()||'?'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5"><span className="text-white text-sm font-medium">{m.author}</span><span className="text-gray-600 text-xs">{new Date(m.timestamp).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}</span></div>
                        {m.content && <p className="text-gray-300 text-sm break-words">{m.content}</p>}
                        {m.attachments?.map((a: string, i: number) => <a key={i} href={a} target="_blank" rel="noreferrer" className="text-blue-400 text-xs underline block">{a.split('/').pop()}</a>)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : (
              <div className="space-y-2">
                {transcripts.length === 0 ? (
                  <Card className="text-center py-12"><p className="text-4xl mb-3">📭</p><p className="text-gray-500 text-sm">Keine Transcripts</p></Card>
                ) : transcripts.map(t => (
                  <div key={t.id} onClick={() => setSelectedTranscript(t)} className="bg-[#13151f] border border-white/[0.05] rounded-2xl px-5 py-4 flex items-center justify-between gap-4 hover:border-white/10 cursor-pointer transition">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎫</span>
                      <div>
                        <p className="text-white font-medium text-sm">#{t.channel_name}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                          <span>{t.category}</span><span>·</span><span>{t.messages.length} Nachrichten</span><span>·</span><span>User: {t.user_id.slice(0,8)}...</span>
                          {t.claimed_by && <><span>·</span><span>Claimed: {t.claimed_by.slice(0,8)}...</span></>}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-gray-500 text-xs">{new Date(t.created_at).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}</p>
                      <p className="text-blue-400 text-xs mt-1">Ansehen →</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── LOGS ── */}
        {section === 'logs' && (
          <div className="space-y-6">
            <div><h2 className="text-xl font-bold text-white">📊 Bot Logs</h2><p className="text-gray-500 text-sm mt-0.5">{logs.length} Einträge</p></div>
            <div className="flex gap-1.5 flex-wrap">
              {[{k:'all',l:'Alle'},{k:'ban',l:'🔨 Bans'},{k:'kick',l:'👢 Kicks'},{k:'timeout',l:'⏱️ Timeouts'},{k:'warn',l:'⚠️ Warns'},{k:'ticket',l:'🎫 Tickets'},{k:'member',l:'👤 Members'},{k:'message',l:'💬 Messages'},{k:'voice',l:'🔊 Voice'}].map(f=>(
                <button key={f.k} onClick={()=>setLogFilter(f.k)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${logFilter===f.k?'bg-blue-600 text-white':'bg-white/5 text-gray-500 hover:text-gray-300'}`}>
                  {f.l} ({f.k==='all'?logs.length:logs.filter(l=>l.action.startsWith(f.k)).length})
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <Card className="text-center py-12"><p className="text-4xl mb-3">📭</p><p className="text-gray-500 text-sm">Keine Logs</p></Card>
              ) : filteredLogs.map(l => (
                <div key={l.id} className="bg-[#13151f] border border-white/[0.05] rounded-2xl px-5 py-3.5 hover:border-white/10 transition">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="text-base flex-shrink-0 mt-0.5">{LOG_ICONS[l.action]||'📋'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-semibold ${LOG_COLORS_CSS[l.action]||'text-gray-300'}`}>{l.action.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span>
                          {l.moderator_id&&<span className="text-blue-400/60 text-xs font-mono">{l.moderator_id.slice(0,8)}...</span>}
                          {l.target_id&&<><span className="text-gray-700">→</span><span className="text-purple-400/60 text-xs font-mono">{l.target_id.slice(0,8)}...</span></>}
                        </div>
                        {l.reason&&<p className="text-gray-600 text-xs mt-0.5 truncate">{l.reason}</p>}
                        {l.details&&Object.keys(l.details).length>0&&(
                          <div className="flex gap-1.5 flex-wrap mt-1">
                            {Object.entries(l.details).slice(0,3).map(([k,v])=>(
                              <span key={k} className="text-gray-700 text-xs bg-white/[0.03] px-2 py-0.5 rounded font-mono">{k}: {String(v).substring(0,30)}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-gray-700 text-xs flex-shrink-0 mt-1">{new Date(l.created_at).toLocaleString('de-DE',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}