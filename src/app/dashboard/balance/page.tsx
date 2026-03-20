'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';

interface Profile {
  id: string;
  username: string;
  role: string;
  balance: number;
}

interface Voucher {
  id: string;
  code: string;
  amount: number;
  currency: string;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  used_profile?: { username: string };
  created_profile?: { username: string };
}

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'add' | 'remove' | 'voucher';
  note: string | null;
  created_at: string;
  user?: { username: string };
  creator?: { username: string };
  voucher?: { code: string };
}

type Tab = 'overview' | 'vouchers' | 'transactions';

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 12; i++) {
    if (i === 4 || i === 8) code += '-';
    else code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function BalancePage() {
  const supabase = createClientSupabaseClient();

  const [myId, setMyId]     = useState('');
  const [myRole, setMyRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<Tab>('overview');
  const [msg, setMsg]         = useState<{ text: string; ok: boolean } | null>(null);

  const [members, setMembers]           = useState<Profile[]>([]);
  const [vouchers, setVouchers]         = useState<Voucher[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  // Guthaben Modal
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [selectedMember, setSelectedMember]     = useState<Profile | null>(null);
  const [balanceAction, setBalanceAction]       = useState<'add' | 'remove'>('add');
  const [balanceAmount, setBalanceAmount]       = useState('');
  const [balanceNote, setBalanceNote]           = useState('');
  const [savingBalance, setSavingBalance]       = useState(false);

  // Gutschein erstellen
  const [showVoucherForm, setShowVoucherForm] = useState(false);
  const [voucherAmount, setVoucherAmount]     = useState('');
  const [voucherCurrency, setVoucherCurrency] = useState('EUR');
  const [voucherCount, setVoucherCount]       = useState('1');
  const [savingVoucher, setSavingVoucher]     = useState(false);
  const [generatedCodes, setGeneratedCodes]   = useState<string[]>([]);

  // Filter
  const [memberSearch, setMemberSearch] = useState('');
  const [voucherFilter, setVoucherFilter] = useState<'all' | 'used' | 'unused'>('all');

  function showMsg(text: string, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 4000);
  }

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMyId(user.id);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile) setMyRole(profile.role);

    const [membersRes, vouchersRes, txRes] = await Promise.all([
      supabase.from('profiles').select('id, username, role, balance').eq('is_active', true).order('username'),
      supabase.from('vouchers').select('*, used_profile:used_by(username), created_profile:created_by(username)').order('created_at', { ascending: false }),
      supabase.from('balance_transactions').select('*, user:user_id(username), creator:created_by(username), voucher:voucher_id(code)').order('created_at', { ascending: false }).limit(100),
    ]);

    setMembers(membersRes.data || []);
    setVouchers(vouchersRes.data || []);
    setTransactions(txRes.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const isTopMgmt = myRole === 'top_management';

  async function updateBalance() {
    if (!selectedMember || !balanceAmount || isNaN(parseFloat(balanceAmount))) return;
    setSavingBalance(true);

    const amount = parseFloat(balanceAmount);
    const newBalance = balanceAction === 'add'
      ? (selectedMember.balance || 0) + amount
      : Math.max(0, (selectedMember.balance || 0) - amount);

    const { error } = await supabase.from('profiles').update({ balance: newBalance }).eq('id', selectedMember.id);
    if (error) { showMsg('Fehler: ' + error.message, false); setSavingBalance(false); return; }

    await supabase.from('balance_transactions').insert({
      user_id: selectedMember.id,
      amount: balanceAction === 'remove' ? -amount : amount,
      type: balanceAction,
      note: balanceNote || null,
      created_by: myId,
    });

    showMsg(`✅ Guthaben ${balanceAction === 'add' ? 'aufgeladen' : 'entfernt'}.`);
    setSavingBalance(false);
    setShowBalanceModal(false);
    setBalanceAmount('');
    setBalanceNote('');
    await load();
  }

  async function generateVouchers() {
    if (!voucherAmount || isNaN(parseFloat(voucherAmount))) return;
    setSavingVoucher(true);

    const count  = Math.min(parseInt(voucherCount) || 1, 50);
    const amount = parseFloat(voucherAmount);
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      const code = generateVoucherCode();
      const { error } = await supabase.from('vouchers').insert({
        code, amount, currency: voucherCurrency, created_by: myId,
      });
      if (!error) codes.push(code);
    }

    setGeneratedCodes(codes);
    showMsg(`✅ ${codes.length} Gutschein${codes.length > 1 ? 'e' : ''} erstellt.`);
    setSavingVoucher(false);
    setVoucherAmount('');
    setVoucherCount('1');
    await load();
  }

  async function deleteVoucher(id: string) {
    if (!confirm('Gutschein löschen?')) return;
    await supabase.from('vouchers').delete().eq('id', id);
    showMsg('✅ Gutschein gelöscht.');
    await load();
  }

  async function redeemVoucher(code: string) {
    const voucher = vouchers.find(v => v.code === code.toUpperCase().trim());
    if (!voucher) { showMsg('Gutschein nicht gefunden.', false); return; }
    if (voucher.is_used) { showMsg('Dieser Gutschein wurde bereits eingelöst.', false); return; }

    const myProfile = members.find(m => m.id === myId);
    if (!myProfile) return;

    const newBalance = (myProfile.balance || 0) + voucher.amount;
    await supabase.from('profiles').update({ balance: newBalance }).eq('id', myId);
    await supabase.from('vouchers').update({ is_used: true, used_by: myId, used_at: new Date().toISOString() }).eq('id', voucher.id);
    await supabase.from('balance_transactions').insert({
      user_id: myId, amount: voucher.amount, type: 'voucher',
      note: `Gutschein eingelöst: ${voucher.code}`,
      voucher_id: voucher.id, created_by: myId,
    });

    showMsg(`✅ ${voucher.amount.toFixed(2)} ${voucher.currency} wurden deinem Guthaben gutgeschrieben!`);
    await load();
  }

  const filteredMembers = members.filter(m =>
    !memberSearch || m.username.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const filteredVouchers = vouchers.filter(v =>
    voucherFilter === 'all' ? true : voucherFilter === 'used' ? v.is_used : !v.is_used
  );

  const myBalance = members.find(m => m.id === myId)?.balance || 0;
  const totalBalance = members.reduce((sum, m) => sum + (m.balance || 0), 0);
  const unusedVouchers = vouchers.filter(v => !v.is_used);
  const unusedValue = unusedVouchers.reduce((sum, v) => sum + v.amount, 0);

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Guthaben & Gutscheine</h1>
        <p className="text-gray-400 text-sm mt-1">Guthaben verwalten und Gutschein-Codes generieren</p>
      </div>

      {msg && (
        <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${msg.ok ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
          {msg.text}
        </div>
      )}

      {/* Mein Guthaben */}
      <div className="bg-gradient-to-br from-blue-600/20 to-violet-600/20 border border-blue-500/30 rounded-2xl p-6">
        <p className="text-gray-400 text-sm mb-1">Mein Guthaben</p>
        <p className="text-4xl font-bold text-white">{myBalance.toFixed(2)} <span className="text-gray-400 text-2xl">EUR</span></p>

        {/* Gutschein einlösen */}
        <div className="mt-4 flex gap-2">
          <input
            id="redeem-input"
            placeholder="Gutschein-Code eingeben..."
            className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-400 font-mono tracking-wider"
          />
          <button
            onClick={() => {
              const input = document.getElementById('redeem-input') as HTMLInputElement;
              if (input?.value) redeemVoucher(input.value);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition">
            Einlösen
          </button>
        </div>
      </div>

      {/* Stats – nur Top Management */}
      {isTopMgmt && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{totalBalance.toFixed(2)}</p>
            <p className="text-gray-400 text-xs mt-1">Gesamtes Guthaben</p>
          </div>
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{unusedVouchers.length}</p>
            <p className="text-gray-400 text-xs mt-1">Offene Gutscheine</p>
          </div>
          <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-400">{unusedValue.toFixed(2)}</p>
            <p className="text-gray-400 text-xs mt-1">Offener Gutscheinwert</p>
          </div>
        </div>
      )}

      {/* Tabs – nur Top Management sieht alle Tabs */}
      {isTopMgmt && (
        <>
          <div className="flex gap-1 bg-[#1a1d27] border border-white/10 rounded-xl p-1">
            {([
              { key: 'overview',     label: '👥 Mitglieder',    },
              { key: 'vouchers',     label: '🎟️ Gutscheine',    },
              { key: 'transactions', label: '📊 Transaktionen', },
            ] as { key: Tab; label: string }[]).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ══ MITGLIEDER ÜBERSICHT ══ */}
          {tab === 'overview' && (
            <div className="space-y-4">
              <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)}
                placeholder="🔍 Mitglied suchen..."
                className="w-full bg-[#1a1d27] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />

              <div className="space-y-2">
                {filteredMembers.map(m => (
                  <div key={m.id} className="bg-[#1a1d27] border border-white/10 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {m.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{m.username}</p>
                        <p className="text-gray-500 text-xs">{m.role?.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={`font-bold text-lg ${(m.balance || 0) > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                          {(m.balance || 0).toFixed(2)}
                        </p>
                        <p className="text-gray-600 text-xs">EUR</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSelectedMember(m); setBalanceAction('add'); setShowBalanceModal(true); }}
                          className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition">
                          + Aufladen
                        </button>
                        <button
                          onClick={() => { setSelectedMember(m); setBalanceAction('remove'); setShowBalanceModal(true); }}
                          disabled={(m.balance || 0) <= 0}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-medium px-3 py-1.5 rounded-lg transition disabled:opacity-30">
                          − Abziehen
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ GUTSCHEINE ══ */}
          {tab === 'vouchers' && (
            <div className="space-y-4">
              {/* Erstellen */}
              <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 space-y-4">
                <h3 className="text-white font-semibold">🎟️ Gutscheine generieren</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Betrag</label>
                    <input type="number" value={voucherAmount} onChange={e => setVoucherAmount(e.target.value)}
                      placeholder="z.B. 10.00"
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Währung</label>
                    <select value={voucherCurrency} onChange={e => setVoucherCurrency(e.target.value)}
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500">
                      <option>EUR</option>
                      <option>USD</option>
                      <option>Robux</option>
                      <option>Coins</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs mb-1 block">Anzahl (max. 50)</label>
                    <input type="number" value={voucherCount} onChange={e => setVoucherCount(e.target.value)}
                      min="1" max="50"
                      className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-3 py-2.5 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <button onClick={generateVouchers} disabled={savingVoucher || !voucherAmount}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition">
                  {savingVoucher ? 'Erstelle...' : '✨ Gutscheine generieren'}
                </button>

                {generatedCodes.length > 0 && (
                  <div className="bg-[#0f1117] border border-emerald-500/20 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-emerald-400 text-xs font-semibold">✅ Generierte Codes:</p>
                      <button
                        onClick={() => navigator.clipboard.writeText(generatedCodes.join('\n'))}
                        className="text-gray-400 hover:text-white text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition">
                        Alle kopieren
                      </button>
                    </div>
                    {generatedCodes.map(code => (
                      <div key={code} className="flex items-center justify-between bg-[#1a1d27] rounded-lg px-3 py-2">
                        <span className="text-white font-mono text-sm tracking-widest">{code}</span>
                        <button onClick={() => navigator.clipboard.writeText(code)}
                          className="text-gray-500 hover:text-white text-xs transition">📋</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Filter */}
              <div className="flex gap-2">
                {(['all', 'unused', 'used'] as const).map(f => (
                  <button key={f} onClick={() => setVoucherFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${voucherFilter === f ? 'bg-blue-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                    {f === 'all' ? 'Alle' : f === 'unused' ? '🟢 Offen' : '⚫ Eingelöst'}
                    <span className="ml-1.5 text-xs opacity-70">
                      ({f === 'all' ? vouchers.length : f === 'unused' ? vouchers.filter(v => !v.is_used).length : vouchers.filter(v => v.is_used).length})
                    </span>
                  </button>
                ))}
              </div>

              {/* Liste */}
              <div className="space-y-2">
                {filteredVouchers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">Keine Gutscheine</div>
                ) : filteredVouchers.map(v => (
                  <div key={v.id} className={`bg-[#1a1d27] border rounded-xl px-5 py-4 flex items-center justify-between gap-4 ${v.is_used ? 'border-white/5 opacity-60' : 'border-white/10'}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${v.is_used ? 'bg-gray-500' : 'bg-emerald-400'}`} />
                      <div>
                        <p className="text-white font-mono font-bold tracking-widest text-sm">{v.code}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span>{new Date(v.created_at).toLocaleDateString('de-DE')}</span>
                          {v.is_used && v.used_profile && (
                            <>
                              <span>·</span>
                              <span>Eingelöst von <span className="text-gray-400">{(v.used_profile as any).username}</span></span>
                              <span>·</span>
                              <span>{v.used_at ? new Date(v.used_at).toLocaleDateString('de-DE') : ''}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-bold ${v.is_used ? 'text-gray-500' : 'text-emerald-400'}`}>
                        {v.amount.toFixed(2)} {v.currency}
                      </span>
                      {!v.is_used && (
                        <>
                          <button onClick={() => navigator.clipboard.writeText(v.code)}
                            className="text-gray-500 hover:text-white text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition">📋</button>
                          <button onClick={() => deleteVoucher(v.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-2 py-1 rounded-lg transition">🗑️</button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ TRANSAKTIONEN ══ */}
          {tab === 'transactions' && (
            <div className="space-y-3">
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">Keine Transaktionen</div>
              ) : transactions.map(tx => {
                const isPositive = tx.amount > 0;
                return (
                  <div key={tx.id} className="bg-[#1a1d27] border border-white/10 rounded-xl px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                          {tx.type === 'voucher' ? '🎟️' : isPositive ? '⬆️' : '⬇️'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm">{(tx.user as any)?.username}</span>
                            <span className="text-gray-500 text-xs">
                              {tx.type === 'voucher' ? 'Gutschein eingelöst' : tx.type === 'add' ? 'Aufgeladen' : 'Abgezogen'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600 mt-0.5">
                            {tx.creator && <span>von {(tx.creator as any)?.username}</span>}
                            {tx.voucher && <span>· Code: {(tx.voucher as any)?.code}</span>}
                            {tx.note && <span>· {tx.note}</span>}
                            <span>· {new Date(tx.created_at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`font-bold text-lg flex-shrink-0 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isPositive ? '+' : ''}{tx.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Guthaben Modal */}
      {showBalanceModal && selectedMember && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d27] border border-white/10 rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-white font-bold text-lg">
                  {balanceAction === 'add' ? '+ Guthaben aufladen' : '− Guthaben abziehen'}
                </h2>
                <p className="text-gray-400 text-xs mt-1">
                  {selectedMember.username} · Aktuell: <span className="text-white font-medium">{(selectedMember.balance || 0).toFixed(2)} EUR</span>
                </p>
              </div>
              <button onClick={() => setShowBalanceModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-gray-400 text-xs mb-1 block">Betrag (EUR)</label>
                <input type="number" value={balanceAmount} onChange={e => setBalanceAmount(e.target.value)}
                  placeholder="z.B. 10.00" min="0.01" step="0.01"
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
              </div>

              {balanceAmount && !isNaN(parseFloat(balanceAmount)) && (
                <div className={`rounded-xl px-4 py-3 text-sm border ${balanceAction === 'add' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  Neues Guthaben: <span className="font-bold">
                    {balanceAction === 'add'
                      ? ((selectedMember.balance || 0) + parseFloat(balanceAmount)).toFixed(2)
                      : Math.max(0, (selectedMember.balance || 0) - parseFloat(balanceAmount)).toFixed(2)
                    } EUR
                  </span>
                </div>
              )}

              <div>
                <label className="text-gray-400 text-xs mb-1 block">Notiz (optional)</label>
                <input value={balanceNote} onChange={e => setBalanceNote(e.target.value)}
                  placeholder="z.B. Bestellung #123, Bonus..."
                  className="w-full bg-[#0f1117] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500" />
              </div>

              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowBalanceModal(false)} className="bg-white/5 hover:bg-white/10 text-gray-300 px-4 py-2.5 rounded-lg text-sm transition">Abbrechen</button>
                <button onClick={updateBalance} disabled={savingBalance || !balanceAmount}
                  className={`flex-1 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg text-sm transition
                    ${balanceAction === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}>
                  {savingBalance ? 'Speichern...' : balanceAction === 'add' ? '+ Aufladen' : '− Abziehen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}