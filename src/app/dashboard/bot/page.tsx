'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';

const BOT_TOKEN = process.env.NEXT_PUBLIC_DISCORD_BOT_TOKEN;
const CLIENT_ID = '1385595812544909443';

const ACTIVITIES = [
  { value: 0, label: 'Spielt' },
  { value: 1, label: 'Streamt' },
  { value: 2, label: 'Hört' },
  { value: 3, label: 'Schaut' },
  { value: 5, label: 'Konkurriert in' },
];

const STATUSES = [
  { value: 'online',    label: '🟢 Online',          color: 'text-green-400' },
  { value: 'idle',      label: '🟡 Abwesend',         color: 'text-yellow-400' },
  { value: 'dnd',       label: '🔴 Nicht stören',     color: 'text-red-400' },
  { value: 'invisible', label: '⚫ Unsichtbar',        color: 'text-gray-400' },
];

type Tab = 'overview' | 'presence' | 'profile' | 'commands' | 'logs';

export default function BotDashboardPage() {
  const [myUsername, setMyUsername]     = useState('');
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<Tab>('overview');
  const [botInfo, setBotInfo]           = useState<any>(null);
  const [botLoading, setBotLoading]     = useState(true);
  const [saving, setSaving]             = useState(false);
  const [saveMsg, setSaveMsg]           = useState('');

  // Presence
  const [status, setStatus]             = useState('online');
  const [activityType, setActivityType] = useState(3);
  const [activityText, setActivityText] = useState('Hamburg V2 Staff Panel');

  // Profile
  const [newUsername, setNewUsername]   = useState('');
  const [avatarUrl, setAvatarUrl]       = useState('');
  const [bannerUrl, setBannerUrl]       = useState('');
  const [bioText, setBioText]           = useState('');

  // Commands (gespeichert in Supabase)
  const [commands, setCommands]         = useState<any[]>([]);
  const [logs, setLogs]                 = useState<any[]>([]);

  const supabase = createClientSupabaseClient();

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();
    if (profile) setMyUsername(profile.username);
    setLoading(false);
  }

  async function loadBotInfo() {
    try {
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bot process.env.NEXT_PUBLIC_BOT_TOKEN` },
      });
      const data = await res.json();
      setBotInfo(data);
    } catch {}
    setBotLoading(false);
  }

  async function loadCommands() {
    const { data } = await supabase.from('bot_commands_config').select('*').order('name');
    setCommands(data || []);
  }

  async function loadLogs() {
    const { data } = await supabase.from('discord_warns').select('*').order('created_at', { ascending: false }).limit(20);
    setLogs(data || []);
  }

  async function updatePresence() {
    setSaving(true);
    try {
      // Presence in Supabase speichern (Bot liest beim Start)
      await supabase.from('bot_config').upsert({
        guild_id: 'global',
        presence_status: status,
        presence_activity_type: activityType,
        presence_activity_text: activityText,
      }, { onConflict: 'guild_id' });
      setSaveMsg('✅ Presence gespeichert! Bot-Neustart nötig um sie anzuwenden.');
    } catch {
      setSaveMsg('❌ Fehler beim Speichern.');
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 4000);
  }

  async function updateBotUsername() {
    if (!newUsername.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('https://discord.com/api/v10/users/@me', {
        method: 'PATCH',
        headers: {
          Authorization: `Bot process.env.NEXT_PUBLIC_BOT_TOKEN`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: newUsername }),
      });
      if (res.ok) {
        setSaveMsg('✅ Bot-Name geändert!');
        loadBotInfo();
      } else {
        const err = await res.json();
        setSaveMsg(`❌ Fehler: ${err.message}`);
      }
    } catch {
      setSaveMsg('❌ Netzwerkfehler.');
    }
    setSaving(false);
    setTimeout(() => setSaveMsg(''), 4000);
  }

  async function updateBotAvatar() {
    if (!avatarUrl.trim()) return;
    setSaving(true);
    try {
      const imgRes = await fetch(avatarUrl);
      const blob = await imgRes.blob();
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const res = await fetch('https://discord.com/api/v10/users/@me', {
          method: 'PATCH',
          headers: {
            Authorization: `Bot process.env.NEXT_PUBLIC_BOT_TOKEN`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ avatar: base64 }),
        });
        if (res.ok) {
          setSaveMsg('✅ Avatar geändert!');
          loadBotInfo();
        } else {
          const err = await res.json();
          setSaveMsg(`❌ Fehler: ${err.message}`);
        }
        setSaving(false);
        setTimeout(() => setSaveMsg(''), 4000);
      };
    } catch {
      setSaveMsg('❌ Fehler beim Laden des Bildes.');
      setSaving(false);
    }
  }

  useEffect(() => {
    loadUser();
    loadBotInfo();
    loadCommands();
    loadLogs();
  }, []);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;
  if (myUsername !== 'jxkerlds') return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <p className="text-6xl mb-4">🔒</p>
        <p className="text-white font-bold text-xl">Kein Zugriff</p>
        <p className="text-gray-400 text-sm mt-1">Dieses Dashboard ist privat.</p>
      </div>
    </div>
  );

  const avatarUrl2 = botInfo?.avatar
    ? `https://cdn.discordapp.com/avatars/${botInfo.id}/${botInfo.avatar}.png?size=256`
    : `https://cdn.discordapp.com/embed/avatars/0.png`;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview',  label: 'Übersicht',  icon: '📊' },
    { key: 'presence',  label: 'Status',     icon: '🟢' },
    { key: 'profile',   label: 'Profil',     icon: '🤖' },
    { key: 'commands',  label: 'Commands',   icon: '⚡' },
    { key: 'logs',      label: 'Warn-Logs',  icon: '📋' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#5865F2]/20 to-[#EB459E]/20 border border-[#5865F2]/30 rounded-2xl p-6">
        <div className="flex items-center gap-5">
          {botLoading ? (
            <div className="w-20 h-20 rounded-full bg-white/10 animate-pulse" />
          ) : (
            <div className="relative">
              <img src={avatarUrl2} alt="Bot Avatar"
                className="w-20 h-20 rounded-full border-2 border-[#5865F2]/50" />
              <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#1a1d27]
                ${status === 'online' ? 'bg-green-500' : status === 'idle' ? 'bg-yellow-500' : status === 'dnd' ? 'bg-red-500' : 'bg-gray-500'}`} />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-white">{botInfo?.username || 'Hamburg V2 Bot'}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/30 font-medium">BOT</span>
            </div>
            <p className="text-gray-400 text-sm mt-0.5">#{botInfo?.discriminator || '0000'} · ID: {botInfo?.id || CLIENT_ID}</p>
            <p className="text-[#5865F2] text-xs mt-1 font-medium">🔒 Privates Dashboard · Nur für jxkerlds</p>
          </div>
        </div>
      </div>

      {/* Save Message */}
      {saveMsg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${saveMsg.startsWith('✅') ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
          {saveMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2
              ${activeTab === tab.key ? 'bg-[#5865F2] text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ─── ÜBERSICHT ──────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-[#5865F2]">15</p>
              <p className="text-gray-400 text-xs mt-1">Commands</p>
            </div>
            <div className="bg-[#1a1d27] border border-green-500/20 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-green-400">Online</p>
              <p className="text-gray-400 text-xs mt-1">Status</p>
            </div>
            <div className="bg-[#1a1d27] border border-purple-500/20 rounded-xl p-5 text-center">
              <p className="text-3xl font-bold text-purple-400">Railway</p>
              <p className="text-gray-400 text-xs mt-1">Hosting</p>
            </div>
          </div>

          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-4">⚡ Verfügbare Commands</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: '/ban', desc: 'Mitglied bannen', cat: 'Moderation' },
                { name: '/kick', desc: 'Mitglied kicken', cat: 'Moderation' },
                { name: '/warn', desc: 'Verwarnung geben', cat: 'Moderation' },
                { name: '/warns', desc: 'Verwarnungen anzeigen', cat: 'Moderation' },
                { name: '/timeout', desc: 'Timeout geben', cat: 'Moderation' },
                { name: '/unban', desc: 'Entbannen', cat: 'Moderation' },
                { name: '/clear', desc: 'Nachrichten löschen', cat: 'Moderation' },
                { name: '/ticket setup', desc: 'Ticket Panel erstellen', cat: 'Admin' },
                { name: '/config', desc: 'Bot konfigurieren', cat: 'Admin' },
                { name: '/announce', desc: 'Ankündigung posten', cat: 'Admin' },
                { name: '/role', desc: 'Rollen verwalten', cat: 'Admin' },
                { name: '/panel', desc: 'TeamPanel Daten', cat: 'Admin' },
                { name: '/userinfo', desc: 'User Infos', cat: 'Info' },
                { name: '/serverinfo', desc: 'Server Infos', cat: 'Info' },
                { name: '/help', desc: 'Alle Commands', cat: 'Info' },
              ].map(cmd => (
                <div key={cmd.name} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-3 py-2.5">
                  <div>
                    <p className="text-white text-sm font-mono font-medium">{cmd.name}</p>
                    <p className="text-gray-500 text-xs">{cmd.desc}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded border
                    ${cmd.cat === 'Moderation' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
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

      {/* ─── STATUS / PRESENCE ───────────────────────────────────────────── */}
      {activeTab === 'presence' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-medium">🟢 Online-Status</h3>
            <div className="grid grid-cols-2 gap-3">
              {STATUSES.map(s => (
                <button key={s.value} onClick={() => setStatus(s.value)}
                  className={`px-4 py-3 rounded-lg border text-sm font-medium transition text-left
                    ${status === s.value ? 'bg-[#5865F2]/20 border-[#5865F2]/50 text-white' : 'bg-[#0f1117] border-white/10 text-gray-400 hover:bg-white/5'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-medium">🎮 Aktivität</h3>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Aktivitätstyp</label>
              <select value={activityType} onChange={e => setActivityType(Number(e.target.value))}
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#5865F2]">
                {ACTIVITIES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-gray-400 text-xs mb-1 block">Aktivitätstext</label>
              <input value={activityText} onChange={e => setActivityText(e.target.value)}
                placeholder="z.B. Hamburg V2 Staff Panel"
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#5865F2]" />
            </div>
            <div className="bg-[#0f1117] rounded-lg p-3 border border-white/5">
              <p className="text-gray-400 text-xs mb-1">Vorschau</p>
              <p className="text-white text-sm">
                <span className="text-gray-400">{ACTIVITIES.find(a => a.value === activityType)?.label} </span>
                <span className="font-medium">{activityText || '...'}</span>
              </p>
            </div>
            <button onClick={updatePresence} disabled={saving}
              className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition">
              {saving ? 'Speichern...' : '💾 Presence speichern'}
            </button>
            <p className="text-gray-500 text-xs text-center">⚠️ Ein Bot-Neustart auf Railway ist nötig um den Status anzuwenden.</p>
          </div>
        </div>
      )}

      {/* ─── PROFIL ──────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-medium">✏️ Bot-Name ändern</h3>
            <p className="text-yellow-400 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              ⚠️ Discord erlaubt nur 2 Namensänderungen pro Stunde!
            </p>
            <div className="flex gap-3">
              <input value={newUsername} onChange={e => setNewUsername(e.target.value)}
                placeholder={botInfo?.username || 'Neuer Bot-Name...'}
                className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#5865F2]" />
              <button onClick={updateBotUsername} disabled={saving || !newUsername.trim()}
                className="bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
                Ändern
              </button>
            </div>
          </div>

          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-medium">🖼️ Avatar ändern</h3>
            <p className="text-yellow-400 text-xs bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
              ⚠️ Bild-URL (PNG/JPG). Discord limitiert Avatar-Änderungen!
            </p>
            <div className="flex gap-3">
              <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.png"
                className="flex-1 bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#5865F2]" />
              <button onClick={updateBotAvatar} disabled={saving || !avatarUrl.trim()}
                className="bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-40 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
                Ändern
              </button>
            </div>
            {avatarUrl && (
              <div className="flex items-center gap-3">
                <img src={avatarUrl} alt="Vorschau" className="w-16 h-16 rounded-full object-cover border border-white/10" onError={e => (e.currentTarget.style.display = 'none')} />
                <p className="text-gray-400 text-xs">Vorschau</p>
              </div>
            )}
          </div>

          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
            <h3 className="text-white font-medium">ℹ️ Aktuelle Bot-Infos</h3>
            {botLoading ? (
              <p className="text-gray-400 text-sm">Lade...</p>
            ) : botInfo ? (
              <div className="space-y-2">
                {[
                  { label: 'Username', value: botInfo.username },
                  { label: 'ID', value: botInfo.id },
                  { label: 'Discriminator', value: `#${botInfo.discriminator}` },
                  { label: 'Verifiziert', value: botInfo.verified ? '✅ Ja' : '❌ Nein' },
                  { label: 'MFA', value: botInfo.mfa_enabled ? '✅ Aktiviert' : '❌ Deaktiviert' },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-2.5">
                    <span className="text-gray-400 text-sm">{item.label}</span>
                    <span className="text-white text-sm font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-red-400 text-sm">Bot-Infos konnten nicht geladen werden.</p>
            )}
          </div>
        </div>
      )}

      {/* ─── COMMANDS ────────────────────────────────────────────────────── */}
      {activeTab === 'commands' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">⚡ Command Übersicht</h3>
            <p className="text-gray-400 text-sm mb-4">Alle Commands sind als Slash Commands registriert. Um Commands zu ändern müssen die JS-Dateien im Bot-Repo bearbeitet und neu deployed werden.</p>
            <div className="space-y-2">
              {[
                { name: 'ban', file: 'src/commands/moderation/ban.js', status: 'aktiv' },
                { name: 'kick', file: 'src/commands/moderation/kick.js', status: 'aktiv' },
                { name: 'warn', file: 'src/commands/moderation/warn.js', status: 'aktiv' },
                { name: 'warns', file: 'src/commands/moderation/warns.js', status: 'aktiv' },
                { name: 'timeout', file: 'src/commands/moderation/timeout.js', status: 'aktiv' },
                { name: 'unban', file: 'src/commands/moderation/unban.js', status: 'aktiv' },
                { name: 'clear', file: 'src/commands/moderation/clear.js', status: 'aktiv' },
                { name: 'ticket', file: 'src/commands/admin/ticket.js', status: 'aktiv' },
                { name: 'config', file: 'src/commands/admin/config.js', status: 'aktiv' },
                { name: 'announce', file: 'src/commands/admin/announce.js', status: 'aktiv' },
                { name: 'role', file: 'src/commands/admin/role.js', status: 'aktiv' },
                { name: 'panel', file: 'src/commands/admin/panel.js', status: 'aktiv' },
                { name: 'userinfo', file: 'src/commands/info/userinfo.js', status: 'aktiv' },
                { name: 'serverinfo', file: 'src/commands/info/serverinfo.js', status: 'aktiv' },
                { name: 'help', file: 'src/commands/info/help.js', status: 'aktiv' },
              ].map(cmd => (
                <div key={cmd.name} className="flex items-center justify-between bg-[#0f1117] rounded-lg px-4 py-3">
                  <div>
                    <p className="text-white text-sm font-mono font-medium">/{cmd.name}</p>
                    <p className="text-gray-500 text-xs">{cmd.file}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded border bg-green-500/10 text-green-400 border-green-500/30">
                    {cmd.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── LOGS ────────────────────────────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
            <h3 className="text-white font-medium mb-3">📋 Letzte Verwarnungen</h3>
            {logs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Keine Verwarnungen vorhanden</p>
            ) : (
              <div className="space-y-2">
                {logs.map(log => (
                  <div key={log.id} className="bg-[#0f1117] rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-sm font-medium">{log.username}</p>
                        <p className="text-gray-400 text-xs mt-0.5">📝 {log.reason}</p>
                        <p className="text-gray-500 text-xs mt-0.5">🛡️ {log.moderator_name}</p>
                      </div>
                      <p className="text-gray-500 text-xs">{new Date(log.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
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
