'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';

type AutomationTrigger =
  | 'conference_created' | 'conference_started' | 'conference_ended'
  | 'conference_cancelled' | 'conference_updated'
  | 'absence_created' | 'absence_approved' | 'absence_rejected' | 'absence_deleted';

interface Webhook {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

interface Automation {
  id: string;
  name: string;
  webhook_id: string;
  trigger: AutomationTrigger;
  message: string;
  ping_roles: string[];
  is_active: boolean;
  created_at: string;
  webhooks?: { name: string };
}

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  conference_created:   'Konferenz erstellt',
  conference_started:   'Konferenz gestartet',
  conference_ended:     'Konferenz beendet',
  conference_cancelled: 'Konferenz abgesagt',
  conference_updated:   'Konferenz geändert',
  absence_created:      'Abmeldung erstellt',
  absence_approved:     'Abmeldung genehmigt',
  absence_rejected:     'Abmeldung abgelehnt',
  absence_deleted:      'Abmeldung gelöscht',
};

const TRIGGER_STYLES: Record<AutomationTrigger, string> = {
  conference_created:   'bg-blue-500/10 text-blue-400 border-blue-500/30',
  conference_started:   'bg-green-500/10 text-green-400 border-green-500/30',
  conference_ended:     'bg-gray-500/10 text-gray-400 border-gray-500/30',
  conference_cancelled: 'bg-red-500/10 text-red-400 border-red-500/30',
  conference_updated:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  absence_created:      'bg-orange-500/10 text-orange-400 border-orange-500/30',
  absence_approved:     'bg-green-500/10 text-green-400 border-green-500/30',
  absence_rejected:     'bg-red-500/10 text-red-400 border-red-500/30',
  absence_deleted:      'bg-gray-500/10 text-gray-400 border-gray-500/30',
};

const VARIABLES: { key: string; desc: string }[] = [
  { key: '{titel}',       desc: 'Titel der Konferenz' },
  { key: '{datum}',       desc: 'Datum & Uhrzeit' },
  { key: '{ersteller}',   desc: 'Wer es erstellt hat' },
  { key: '{mitglied}',    desc: 'Betroffenes Mitglied' },
  { key: '{von}',         desc: 'Abmeldung von (Datum)' },
  { key: '{bis}',         desc: 'Abmeldung bis (Datum)' },
  { key: '{grund}',       desc: 'Grund der Abmeldung' },
  { key: '{status}',      desc: 'Status' },
];

export default function AutomationsPage() {
  const [webhooks, setWebhooks]         = useState<Webhook[]>([]);
  const [automations, setAutomations]   = useState<Automation[]>([]);
  const [myRole, setMyRole]             = useState<UserRole | null>(null);
  const [myId, setMyId]                 = useState<string>('');
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState<'automations' | 'webhooks'>('automations');
  const [showWebhookForm, setShowWebhookForm]     = useState(false);
  const [showAutomationForm, setShowAutomationForm] = useState(false);
  const [editAutomation, setEditAutomation]       = useState<Automation | null>(null);
  const [testingId, setTestingId]       = useState<string | null>(null);
  const [testResult, setTestResult]     = useState<string | null>(null);

  const [webhookForm, setWebhookForm] = useState({ name: '', url: '' });
  const [autoForm, setAutoForm]       = useState({
    name: '',
    webhook_id: '',
    trigger: 'conference_created' as AutomationTrigger,
    message: '',
    ping_roles: '',
    is_active: true,
  });

  const supabase = createClientSupabaseClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.id).single();
    if (profile) setMyRole(profile.role as UserRole);

    const { data: wh } = await supabase.from('webhooks').select('*').order('created_at');
    const { data: au } = await supabase
      .from('automations')
      .select('*, webhooks(name)')
      .order('created_at');

    setWebhooks(wh || []);
    setAutomations(au || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function createWebhook() {
    if (!webhookForm.name.trim() || !webhookForm.url.trim()) return;
    await supabase.from('webhooks').insert({
      name: webhookForm.name,
      url: webhookForm.url,
      created_by: myId,
    });
    setWebhookForm({ name: '', url: '' });
    setShowWebhookForm(false);
    load();
  }

  async function deleteWebhook(id: string) {
    await supabase.from('webhooks').delete().eq('id', id);
    load();
  }

  async function saveAutomation() {
    if (!autoForm.name.trim() || !autoForm.webhook_id || !autoForm.message.trim()) return;
    const pingRoles = autoForm.ping_roles
      .split(',')
      .map(r => r.trim())
      .filter(r => r.length > 0);

    if (editAutomation) {
      await supabase.from('automations').update({
        name: autoForm.name,
        webhook_id: autoForm.webhook_id,
        trigger: autoForm.trigger,
        message: autoForm.message,
        ping_roles: pingRoles,
        is_active: autoForm.is_active,
      }).eq('id', editAutomation.id);
      setEditAutomation(null);
    } else {
      await supabase.from('automations').insert({
        name: autoForm.name,
        webhook_id: autoForm.webhook_id,
        trigger: autoForm.trigger,
        message: autoForm.message,
        ping_roles: pingRoles,
        is_active: autoForm.is_active,
        created_by: myId,
      });
    }
    setAutoForm({ name: '', webhook_id: '', trigger: 'conference_created', message: '', ping_roles: '', is_active: true });
    setShowAutomationForm(false);
    load();
  }

  async function toggleAutomation(id: string, current: boolean) {
    await supabase.from('automations').update({ is_active: !current }).eq('id', id);
    load();
  }

  async function deleteAutomation(id: string) {
    await supabase.from('automations').delete().eq('id', id);
    load();
  }

  async function testAutomation(automation: Automation) {
    setTestingId(automation.id);
    setTestResult(null);
    const webhook = webhooks.find(w => w.id === automation.webhook_id);
    if (!webhook) { setTestResult('Webhook nicht gefunden!'); setTestingId(null); return; }

    const testMessage = automation.message
      .replace('{titel}', 'Test Konferenz')
      .replace('{datum}', new Date().toLocaleString('de-DE'))
      .replace('{ersteller}', 'Test User')
      .replace('{mitglied}', 'Test Mitglied')
      .replace('{von}', '01.01.2025')
      .replace('{bis}', '02.01.2025')
      .replace('{grund}', 'Test Grund')
      .replace('{status}', 'Test Status');

    const pings = automation.ping_roles.map(r => `<@&${r}>`).join(' ');
    const content = pings ? `${pings}\n${testMessage}` : testMessage;

    try {
      const res = await fetch(webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      setTestResult(res.ok ? '✅ Erfolgreich gesendet!' : `❌ Fehler: ${res.status}`);
    } catch {
      setTestResult('❌ Verbindungsfehler');
    }
    setTestingId(null);
  }

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  if (myRole !== 'top_management') {
    return <div className="text-center py-12 text-gray-400">Kein Zugriff.</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Automatisierungen</h1>
        <p className="text-gray-400 text-sm mt-1">Discord Webhooks & Automatisierungen verwalten</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setActiveTab('automations')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition
            ${activeTab === 'automations' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          Automatisierungen ({automations.length})
        </button>
        <button onClick={() => setActiveTab('webhooks')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition
            ${activeTab === 'webhooks' ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          Webhooks ({webhooks.length})
        </button>
      </div>

      {/* Webhooks Tab */}
      {activeTab === 'webhooks' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowWebhookForm(!showWebhookForm)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Webhook hinzufügen
            </button>
          </div>

          {showWebhookForm && (
            <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
              <h3 className="text-white font-medium">Neuer Webhook</h3>
              <input value={webhookForm.name}
                onChange={e => setWebhookForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Name (z.B. Konferenz-Channel)..."
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                           text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
              <input value={webhookForm.url}
                onChange={e => setWebhookForm(p => ({ ...p, url: e.target.value }))}
                placeholder="Discord Webhook URL..."
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                           text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowWebhookForm(false)}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm transition">
                  Abbrechen
                </button>
                <button onClick={createWebhook}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
                  Speichern
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {webhooks.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">Keine Webhooks vorhanden</div>
            ) : webhooks.map(wh => (
              <div key={wh.id} className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-white font-medium text-sm">{wh.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5 font-mono truncate max-w-xs">{wh.url.substring(0, 50)}...</p>
                </div>
                <button onClick={() => deleteWebhook(wh.id)}
                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30
                             text-xs font-medium px-3 py-1.5 rounded-lg transition">
                  Löschen
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Automatisierungen Tab */}
      {activeTab === 'automations' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setShowAutomationForm(!showAutomationForm); setEditAutomation(null); setAutoForm({ name: '', webhook_id: '', trigger: 'conference_created', message: '', ping_roles: '', is_active: true }); }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Automatisierung erstellen
            </button>
          </div>

          {/* Automatisierung Formular */}
          {(showAutomationForm || editAutomation) && (
            <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
              <h3 className="text-white font-medium">{editAutomation ? 'Automatisierung bearbeiten' : 'Neue Automatisierung'}</h3>

              <input value={autoForm.name}
                onChange={e => setAutoForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Name der Automatisierung..."
                className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                           text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Webhook</label>
                  <select value={autoForm.webhook_id}
                    onChange={e => setAutoForm(p => ({ ...p, webhook_id: e.target.value }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Webhook wählen...</option>
                    {webhooks.map(wh => (
                      <option key={wh.id} value={wh.id}>{wh.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Trigger</label>
                  <select value={autoForm.trigger}
                    onChange={e => setAutoForm(p => ({ ...p, trigger: e.target.value as AutomationTrigger }))}
                    className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5
                               text-white text-sm focus:outline-none focus:border-blue-500">
                    {(Object.keys(TRIGGER_LABELS) as AutomationTrigger[]).map(t => (
                      <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Discord Rollen pingen (IDs kommagetrennt)</label>
                <input value={autoForm.ping_roles}
                  onChange={e => setAutoForm(p => ({ ...p, ping_roles: e.target.value }))}
                  placeholder="z.B. 123456789, 987654321"
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                             text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Nachricht</label>
                <textarea value={autoForm.message}
                  onChange={e => setAutoForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Nachrichteninhalt... Variablen: {titel}, {datum}, {ersteller}, {mitglied}, {von}, {bis}, {grund}, {status}"
                  rows={4}
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-2.5
                             text-white placeholder-gray-500 text-sm focus:outline-none
                             focus:border-blue-500 resize-none font-mono" />
              </div>

              {/* Variablen Übersicht */}
              <div className="bg-[#0f1117] rounded-lg p-3">
                <p className="text-gray-400 text-xs font-medium mb-2">Verfügbare Variablen:</p>
                <div className="flex flex-wrap gap-2">
                  {VARIABLES.map(v => (
                    <button key={v.key}
                      onClick={() => setAutoForm(p => ({ ...p, message: p.message + v.key }))}
                      title={v.desc}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30
                                 text-xs px-2 py-1 rounded transition font-mono">
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="is_active"
                  checked={autoForm.is_active}
                  onChange={e => setAutoForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="rounded" />
                <label htmlFor="is_active" className="text-gray-300 text-sm">Automatisierung aktiv</label>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowAutomationForm(false); setEditAutomation(null); }}
                  className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2 rounded-lg text-sm transition">
                  Abbrechen
                </button>
                <button onClick={saveAutomation}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
                  Speichern
                </button>
              </div>
            </div>
          )}

          {testResult && (
            <div className={`p-3 rounded-lg text-sm text-center ${testResult.includes('✅') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {testResult}
            </div>
          )}

          <div className="space-y-3">
            {automations.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">Keine Automatisierungen vorhanden</div>
            ) : automations.map(auto => (
              <div key={auto.id} className={`bg-[#1a1d27] border rounded-xl p-5 ${auto.is_active ? 'border-white/10' : 'border-white/5 opacity-60'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-white font-medium">{auto.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded border ${TRIGGER_STYLES[auto.trigger]}`}>
                        {TRIGGER_LABELS[auto.trigger]}
                      </span>
                      {!auto.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded border bg-gray-500/10 text-gray-500 border-gray-500/30">
                          Inaktiv
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-xs mb-1">
                      Webhook: {auto.webhooks?.name || '–'}
                    </p>
                    {auto.ping_roles.length > 0 && (
                      <p className="text-gray-400 text-xs mb-1">
                        Pings: {auto.ping_roles.map(r => `@${r}`).join(', ')}
                      </p>
                    )}
                    <p className="text-gray-500 text-xs font-mono bg-[#0f1117] rounded p-2 mt-2 whitespace-pre-wrap">
                      {auto.message.substring(0, 100)}{auto.message.length > 100 ? '...' : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                    <button onClick={() => testAutomation(auto)}
                      disabled={testingId === auto.id}
                      className="bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border
                                 border-purple-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                      {testingId === auto.id ? 'Sende...' : 'Testen'}
                    </button>
                    <button onClick={() => toggleAutomation(auto.id, auto.is_active)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition
                        ${auto.is_active
                          ? 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/30'}`}>
                      {auto.is_active ? 'Deaktivieren' : 'Aktivieren'}
                    </button>
                    <button onClick={() => {
                      setEditAutomation(auto);
                      setAutoForm({
                        name: auto.name,
                        webhook_id: auto.webhook_id,
                        trigger: auto.trigger,
                        message: auto.message,
                        ping_roles: auto.ping_roles.join(', '),
                        is_active: auto.is_active,
                      });
                      setShowAutomationForm(false);
                    }}
                      className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border
                                 border-blue-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                      Bearbeiten
                    </button>
                    <button onClick={() => deleteAutomation(auto.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border
                                 border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                      Löschen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}