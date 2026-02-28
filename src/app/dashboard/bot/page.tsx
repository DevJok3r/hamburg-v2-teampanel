'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';

const CLIENT_ID = '1385595812544909443';

const ACTIVITIES = [
  { value: 0, label: '🎮 Spielt' },
  { value: 1, label: '📺 Streamt' },
  { value: 2, label: '🎵 Hört' },
  { value: 3, label: '👁️ Schaut' },
  { value: 5, label: '🏆 Konkurriert in' },
];

const STATUSES = [
  { value: 'online',    label: 'Online',       dot: 'bg-green-500' },
  { value: 'idle',      label: 'Abwesend',     dot: 'bg-yellow-500' },
  { value: 'dnd',       label: 'Nicht stören', dot: 'bg-red-500' },
  { value: 'invisible', label: 'Unsichtbar',   dot: 'bg-gray-500' },
];

const ALL_COMMANDS = [
  'ban', 'kick', 'warn', 'warns', 'timeout', 'unban', 'clear',
  'ticket', 'config', 'announce', 'role', 'panel',
  'userinfo', 'serverinfo', 'help',
];

type Tab = 'overview' | 'presence' | 'profile' | 'access' | 'permissions' | 'logs';

export default function BotDashboardPage() {
  const [myUsername, setMyUsername] = useState('');
  const [loading, setLoading]       = useState(true);
  const [hasAccess, setHasAccess]   = useState(false);
  const [activeTab, setActiveTab]   = useState<Tab>('overview');
  const [botInfo, setBotInfo]       = useState<any>(null);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState<{ text: string; ok: boolean } | null>(null);

  // Presence
  const [presence, setPresence] = useState({ status: 'online', activity_type: 3, activity_text: 'Hamburg V2 Staff Panel' });

  // Profile
  const [newUsername, setNewUsername] = useState('');
  const [avatarUrl, setAvatarUrl]     = useState('');

  // Dashboard Access
  const [accessList, setAccessList]   = useState<any[]>([]);
  const [newAccessUser, setNewAccessUser] = useState('');

  // Command Permissions
  const [discordRoles, setDiscordRoles]   = useState<any[]>([]);
  const [cmdPerms, setCmdPerms]           = useState<Record<string, string[]>>({}); // command → role_ids

  // Logs
  const [warns, setWarns]     = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  const supabase = createClientSupabaseClient();

  function showMsg(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  // ─── LOAD ──────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    const username = profile?.username || '';
    setMyUsername(username);

    const { data: accessRow } = await supabase.from('bot_dashboard_access').select('*').eq('username', username).single();
    const access = !!accessRow;
    setHasAccess(access);
    if (!access) { setLoading(false); return; }

    // Presence
    const { data: presRow } = await supabase.from('bot_config').select('value').eq('key', 'presence').single();
    if (presRow?.value) setPresence(presRow.value);

    // Bot Info
    try {
      const res = await fetch('/api/discord-bot-info');
      if (res.ok) setBotInfo(await res.json());
    } catch {}

    // Access List
    const { data: al } = await supabase.from('bot_dashboard_access').select('*').order('created_at');
    setAccessList(al || []);

    // Discord Rollen (aus dem Server)
    await loadDiscordRoles();

    // Command Permissions
    const { data: cp } = await supabase.from('bot_command_permissions').select('*');
    const map: Record<string, string[]> = {};
    (cp || []).forEach((row: any) => {
      if (!map[row.command_name]) map[row.command_name] = [];
      map[row.command_name].push(row.discord_role_id);
    });
    setCmdPerms(map);

    // Logs
    const { data: w } = await supabase.from('discord_warns').select('*').order('created_at', { ascending: false }).limit(30);
    setWarns(w || []);
    const { data: t } = await supabase.from('tickets').select('*').order('created_at', { ascending: false }).limit(30);
    setTickets(t || []);

    setLoading(false);
  }, []);

  async function loadDiscordRoles() {
    try {
      const res = await fetch('/api/discord-roles');
      const data = await res.json();
      setDiscordRoles(data.roles || []);
    } catch {}
  }

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── PRESENCE SPEICHERN ────────────────────────────────────────────────────
  async function savePresence() {
    setSaving(true);
    const { error } = await supabase.from('bot_config')
      .update({ value: presence, updated_at: new Date().toISOString() })
      .eq('key', 'presence');
    if (error) showMsg('❌ Fehler beim Speichern.', false);
    else showMsg('✅ Presence aktualisiert! Bot ändert Status automatisch.');
    setSaving(false);
  }

  // ─── BOT USERNAME ÄNDERN ──────────────────────────────────────────────────
  async function saveBotUsername() {
    if (!newUsername.trim()) return;
    setSaving(true);
    const res = await fetch('/api/discord-bot-edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername }),
    });
    if (res.ok) {
      setBotInfo(await res.json());
      setNewUsername('');
      showMsg('✅ Bot-Name geändert!');
    } else {
      const err = await res.json();
      showMsg(`❌ ${err.error || err.message}`, false);
    }
    setSaving(false);
  }

  // ─── AVATAR ÄNDERN ────────────────────────────────────────────────────────
  async function saveBotAvatar() {
    if (!avatarUrl.trim()) return;
    setSaving(true);
    try {
      const imgRes = await fetch(avatarUrl);
      const blob = await imgRes.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await fetch('/api/discord-bot-edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatar: base64 }),
        });
        if (res.ok) { setBotInfo(await res.json()); showMsg('✅ Avatar geändert!'); }
        else { const err = await res.json(); showMsg(`❌ ${err.error || err.message}`, false); }
        setSaving(false);
      };
    } catch { showMsg('❌ Bild konnte nicht geladen werden.', false); setSaving(false); }
  }

  // ─── DASHBOARD ZUGRIFF ────────────────────────────────────────────────────
  async function grantAccess() {
    if (!newAccessUser.trim()) return;
    const { error } = await supabase.from('bot_dashboard_access').insert({ username: newAccessUser.trim(), granted_by: myUsername });
    if (error) showMsg(`❌ ${error.message}`, false);
    else { showMsg(`✅ ${newAccessUser} hat jetzt Zugriff!`); setNewAccessUser(''); loadAll(); }
  }

  async function revokeAccess(username: string) {
    if (username === 'jxkerlds') return showMsg('❌ jxkerlds kann nicht entfernt werden.', false);
    await supabase.from('bot_dashboard_access').delete().eq('username', username);
    showMsg(`✅ Zugriff für ${username} entzogen.`);
    loadAll();
  }

  // ─── COMMAND PERMISSIONS ──────────────────────────────────────────────────
  async function toggleCmdPerm(command: string, roleId: string, roleName: string) {
    const current = cmdPerms[command] || [];
    const has = current.includes(roleId);
    if (has) {
      await supabase.from('bot_command_permissions').delete()
        .eq('command_name', command).eq('discord_role_id', roleId);
      setCmdPerms(p => ({ ...p, [command]: (p[command] || []).filter(id => id !== roleId) }));
    } else {
      await supabase.from('bot_command_permissions').upsert({
        command_name: command, discord_role_id: roleId, discord_role_name: roleName,
      }, { onConflict: 'command_name,discord_role_id' });
      setCmdPerms(p => ({ ...p, [command]: [...(p[command] || []), roleId] }));
    }
  }

  // ─── LOADING / NO ACCESS ──────────────────────────────────────────────────
  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  if (!hasAccess) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <p className="text-6xl mb-4">🔒</p>
        <p className="text-white font-bold text-xl mb-1">Kein Zugriff</p>
        <p className="text-gray-400 text-sm">Dieses Dashboard ist privat.</p>
      </div>
    </div>
  );

  const avatarSrc = botInfo?.avatar
    ? `https://cdn.discordapp.com/avatars/${botInfo.id}/${botInfo.avatar}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const currentStatus = STATUSES.find(s => s.value === presence.status);

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',     label: 'Übersicht',    icon: '📊' },
    { key: 'presence',     label: 'Status',        icon: '🟢' },
    { key: 'profile',      label: 'Profil',        icon: '🤖' },
    { key: 'permissions',  label: 'Berechtigungen',icon: '⚡' },
    { key: 'access',       label: 'Zugriff',       icon: '🔑' },
    { key: 'logs',         label: 'Logs',          icon: '📋' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#5865F2]/20 via-[#5865F2]/10 to-transparent border border-[#5865F2]/30 rounded-2xl p-6">
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <img src={avatarSrc} alt="Bot" className="w-20 h-20 rounded-full border-2 border-[#5865F2]/40" />
            <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#0f1117] ${currentStatus?.dot || 'bg-green-500'}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{botInfo?.username || 'Hamburg V2 Bot'}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30 font-bold">BOT</span>
            </div>
            <p className="text-gray-400 text-sm mt-0.5">ID: {botInfo?.id || CLIENT_ID}</p>
            <p className="text-[#5865F2] text-xs mt-1">🔒 Privates Bot-Dashboard · {myUsername}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
              presence.status === 'online' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
              presence.status === 'idle' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
              presence.status === 'dnd' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
              'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
              <div className={`w-2 h-2 rounded-full ${currentStatus?.dot}`} />
              {currentStatus?.label}
            </div>
            <p className="text-gray-500 text-xs mt-1">{ACTIVITIES.find(a => a.value === presence.activity_type)?.label} {presence.activity_text}</p>
          </div>
        </div>
      </div>

      {/* Message */}
      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border transition ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2
              ${activeTab === tab.key ? 'bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20' : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── ÜBERSICHT ──────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a1d27] border border-[#5865F2]/20 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-[#5865F2]">{ALL_COMMANDS.length}</p>
              <p className="text-gray-400 text-xs mt-1">Slash Commands</p>
            </div>
            <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-green-400">{warns.length}</p>
              <p className="text-gray-400 text-xs mt-1">Verwarnungen</p>
            </div>
            <div className="bg-[#1a1d27] border border-purple-500/20 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-purple-400">{tickets.length}</p>
              <p className="text-gray-400 text-xs mt-1">Tickets gesamt</p>
            </div>
          </div>

          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">⚡ Alle Commands</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: '/ban', cat: 'Mod', desc: 'Mitglied bannen' },
                { name: '/kick', cat: 'Mod', desc: 'Mitglied kicken' },
                { name: '/warn', cat: 'Mod', desc: 'Verwarnung geben' },
                { name: '/warns', cat: 'Mod', desc: 'Verwarnungen anzeigen' },
                { name: '/timeout', cat: 'Mod', desc: 'Timeout geben' },
                { name: '/unban', cat: 'Mod', desc: 'Entbannen' },
                { name: '/clear', cat: 'Mod', desc: 'Nachrichten löschen' },
                { name: '/ticket', cat: 'Admin', desc: 'Ticket System' },
                { name: '/config', cat: 'Admin', desc: 'Bot konfigurieren' },
                { name: '/announce', cat: 'Admin', desc: 'Ankündigung posten' },
                { name: '/role', cat: 'Admin', desc: 'Rollen verwalten' },
                { name: '/panel', cat: 'Admin', desc: 'TeamPanel Daten' },
                { name: '/userinfo', cat: 'Info', desc: 'User Infos' },
                { name: '/serverinfo', cat: 'Info', desc: 'Server Infos' },
                { name: '/help', cat: 'Info', desc: 'Alle Commands' },
              ].map(cmd => (
                <div key={cmd.name} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-white text-sm font-mono font-medium">{cmd.name}</p>
                    <p className="text-gray-500 text-xs">{cmd.desc}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border ${
                    cmd.cat === 'Mod' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                    cmd.cat === 'Admin' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                    'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
                    {cmd.cat}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── PRESENCE ───────────────────────────────────────────────────────── */}
      {activeTab === 'presence' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-5">
            <h3 className="text-white font-medium">🟢 Status einstellen</h3>

            <div>
              <label className="text-gray-400 text-xs mb-2 block">Online-Status</label>
              <div className="grid grid-cols-2 gap-2">
                {STATUSES.map(s => (
                  <button key={s.value} onClick={() => setPresence(p => ({ ...p, status: s.value }))}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition
                      ${presence.status === s.value ? 'bg-[#5865F2]/20 border-[#5865F2]/50 text-white' : 'bg-[#0f1117] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                    <div className={`w-3 h-3 rounded-full ${s.dot}`} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-2 block">Aktivitätstyp</label>
              <div className="grid grid-cols-3 gap-2">
                {ACTIVITIES.map(a => (
                  <button key={a.value} onClick={() => setPresence(p => ({ ...p, activity_type: a.value }))}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium transition
                      ${presence.activity_type === a.value ? 'bg-[#5865F2]/20 border-[#5865F2]/50 text-white' : 'bg-[#0f1117] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-gray-400 text-xs mb-2 block">Aktivitätstext</label>
              <input value={presence.activity_text}
                onChange={e => setPresence(p => ({ ...p, activity_text: e.target.value }))}
                placeholder="z.B. Hamburg V2 Staff Panel"
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#5865F2]" />
            </div>

            <div className="bg-[#0f1117] rounded-lg p-4 border border-white/5">
              <p className="text-gray-500 text-xs mb-1">Discord Vorschau</p>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${currentStatus?.dot}`} />
                <p className="text-white text-sm">
                  <span className="text-gray-400">{ACTIVITIES.find(a => a.value === presence.activity_type)?.label} </span>
                  <span className="font-medium">{presence.activity_text || '...'}</span>
                </p>
              </div>
            </div>

            <button onClick={savePresence} disabled={saving}
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-40 text-white font-medium py-3 rounded-lg text-sm transition shadow-lg shadow-[#5865F2]/20">
              {saving ? 'Speichern...' : '💾 Sofort anwenden (kein Restart nötig!)'}
            </button>
          </div>
        </div>
      )}

      {/* ─── PROFIL ─────────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          {/* Bot Info */}
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">ℹ️ Bot Informationen</h3>
            <div className="space-y-2">
              {[
                { label: 'Username', value: botInfo?.username || '–' },
                { label: 'ID', value: botInfo?.id || CLIENT_ID },
                { label: 'Verifiziert', value: botInfo?.verified ? '✅ Ja' : '❌ Nein' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-3">
                  <span className="text-gray-400 text-sm">{item.label}</span>
                  <span className="text-white text-sm font-medium font-mono">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Username ändern */}
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-3">
            <h3 className="text-white font-medium">✏️ Bot-Name ändern</h3>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              <p className="text-yellow-400 text-xs">⚠️ Discord erlaubt nur 2 Namensänderungen pro Stunde!</p>
            </div>
            <div className="flex gap-3">
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)}
                placeholder="Neuer Bot-Name..."
                className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#5865F2]" />
              <button onClick={saveBotUsername} disabled={saving || !newUsername.trim()}
                className="bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
                Ändern
              </button>
            </div>
          </div>

          {/* Avatar ändern */}
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-3">
            <h3 className="text-white font-medium">🖼️ Avatar ändern</h3>
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              <p className="text-yellow-400 text-xs">⚠️ Direkte Bild-URL angeben (PNG/JPG). Discord limitiert Avatar-Änderungen!</p>
            </div>
            <div className="flex gap-3">
              <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#5865F2]" />
              <button onClick={saveBotAvatar} disabled={saving || !avatarUrl.trim()}
                className="bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
                Ändern
              </button>
            </div>
            {avatarUrl && (
              <img src={avatarUrl} alt="Vorschau" className="w-16 h-16 rounded-full object-cover border border-white/10"
                onError={e => (e.currentTarget.style.display = 'none')} />
            )}
          </div>
        </div>
      )}

      {/* ─── BERECHTIGUNGEN ─────────────────────────────────────────────────── */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-1">⚡ Discord Rollen → Command Zugriff</h3>
            <p className="text-gray-400 text-xs mb-4">Wähle welche Discord-Rollen welche Commands nutzen dürfen. Keine Auswahl = jeder kann den Command nutzen (Discord Standard).</p>

            {discordRoles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 text-sm">Discord Rollen konnten nicht geladen werden.</p>
                <p className="text-gray-600 text-xs mt-1">Stelle sicher dass NEXT_PUBLIC_BOT_TOKEN gesetzt ist.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ALL_COMMANDS.map(cmd => {
                  const allowedRoles = cmdPerms[cmd] || [];
                  return (
                    <div key={cmd} className="bg-[#0f1117] rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-white font-mono font-medium text-sm">/{cmd}</p>
                        <span className="text-gray-500 text-xs">{allowedRoles.length === 0 ? 'Alle' : `${allowedRoles.length} Rolle(n)`}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {discordRoles.map((role: any) => {
                          const active = allowedRoles.includes(role.id);
                          const color = role.color ? `#${role.color.toString(16).padStart(6, '0')}` : '#99aab5';
                          return (
                            <button key={role.id}
                              onClick={() => toggleCmdPerm(cmd, role.id, role.name)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${active ? 'opacity-100' : 'opacity-40 hover:opacity-70'}`}
                              style={active ? { backgroundColor: `${color}20`, color, borderColor: `${color}40` } : { backgroundColor: 'transparent', color: '#6b7280', borderColor: '#374151' }}>
                              {active ? '✓ ' : ''}{role.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ZUGRIFF ────────────────────────────────────────────────────────── */}
      {activeTab === 'access' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-medium">🔑 Dashboard-Zugriff verwalten</h3>
            <p className="text-gray-400 text-xs">Nur diese Personen können das Bot-Dashboard sehen. Username muss exakt mit dem TeamPanel-Username übereinstimmen.</p>

            <div className="flex gap-3">
              <input value={newAccessUser} onChange={e => setNewAccessUser(e.target.value)}
                placeholder="TeamPanel Username..."
                className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#5865F2]"
                onKeyDown={e => e.key === 'Enter' && grantAccess()} />
              <button onClick={grantAccess} disabled={!newAccessUser.trim()}
                className="bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
                Hinzufügen
              </button>
            </div>

            <div className="space-y-2">
              {accessList.map(entry => (
                <div key={entry.id} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-[#5865F2] to-[#EB459E] rounded-full flex items-center justify-center text-white font-bold text-xs">
                      {entry.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{entry.username}</p>
                      <p className="text-gray-500 text-xs">Hinzugefügt von {entry.granted_by} · {new Date(entry.created_at).toLocaleDateString('de-DE')}</p>
                    </div>
                  </div>
                  {entry.username !== 'jxkerlds' ? (
                    <button onClick={() => revokeAccess(entry.username)}
                      className="text-xs px-3 py-1.5 rounded-lg border bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 transition">
                      Entfernen
                    </button>
                  ) : (
                    <span className="text-xs px-3 py-1.5 rounded-lg border bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                      👑 Owner
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── LOGS ───────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Verwarnungen */}
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">⚠️ Verwarnungen ({warns.length})</h3>
            {warns.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Keine Verwarnungen</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {warns.map(w => (
                  <div key={w.id} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-3">
                    <div>
                      <p className="text-white text-sm font-medium">{w.username}</p>
                      <p className="text-gray-400 text-xs">📝 {w.reason} · 🛡️ {w.moderator_name}</p>
                    </div>
                    <p className="text-gray-500 text-xs flex-shrink-0">{new Date(w.created_at).toLocaleDateString('de-DE')}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tickets */}
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">🎫 Tickets ({tickets.length})</h3>
            {tickets.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Keine Tickets</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tickets.map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-3">
                    <div>
                      <p className="text-white text-sm font-medium">{t.username}</p>
                      <p className="text-gray-400 text-xs">📋 {t.category}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded border ${t.status === 'open' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-gray-500/10 text-gray-400 border-gray-500/30'}`}>
                      {t.status === 'open' ? 'Offen' : 'Geschlossen'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}