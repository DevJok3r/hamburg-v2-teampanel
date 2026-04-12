'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { ROLE_LABELS, DEPT_LABELS, can } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';
import Link from 'next/link';

export default function DashboardPage() {
  const supabase = createClientSupabaseClient();
  const [profile, setProfile]   = useState<any>(null);
  const [stats, setStats]       = useState({ members: 0, absences: 0, conferences: 0, todos: 0 });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(p);

      const [membersRes, absencesRes, confRes, todosRes, logsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('absences').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('conferences').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
        supabase.from('todos').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('system_logs').select('*').order('created_at', { ascending: false }).limit(5),
      ]);

      setStats({
        members:     membersRes.count || 0,
        absences:    absencesRes.count || 0,
        conferences: confRes.count || 0,
        todos:       todosRes.count || 0,
      });
      setRecentLogs(logsRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 mx-auto animate-pulse" />
        <p className="text-gray-500 text-sm">Lade Dashboard...</p>
      </div>
    </div>
  );

  const role = profile?.role as UserRole;
  const depts = profile?.departments || [];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Willkommen zurück, <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-blue-400 bg-clip-text text-transparent">{profile?.username}</span> 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">CandyLife Staff Portal · FiveM Roleplay</p>
        </div>
        <RoleBadge role={role} size="md" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Aktive Mitglieder', value: stats.members,     icon: '👥', color: 'from-pink-500 to-rose-500',     border: 'border-pink-500/20' },
          { label: 'Offene Abmeldungen', value: stats.absences,   icon: '📅', color: 'from-purple-500 to-violet-500', border: 'border-purple-500/20' },
          { label: 'Konferenzen',        value: stats.conferences, icon: '🎯', color: 'from-blue-500 to-indigo-500',   border: 'border-blue-500/20' },
          { label: 'Offene Aufgaben',    value: stats.todos,       icon: '✅', color: 'from-cyan-500 to-teal-500',     border: 'border-cyan-500/20' },
        ].map(s => (
          <div key={s.label} className={`bg-[#13151f] border ${s.border} rounded-2xl p-5`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center text-xl mb-3`}>
              {s.icon}
            </div>
            <p className="text-3xl font-bold text-white">{s.value}</p>
            <p className="text-gray-500 text-xs mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Nav */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { href: '/dashboard/absences',      label: 'Abmeldungen',  icon: '📅', desc: 'Urlaub & Abwesenheiten' },
          { href: '/dashboard/conferences',   label: 'Konferenzen',  icon: '🎯', desc: 'Meetings & Sitzungen' },
          { href: '/dashboard/todos',         label: 'Aufgaben',     icon: '✅', desc: 'Offene Tasks' },
          ...(can.isSenior(role) ? [
            { href: '/dashboard/users',             label: 'Mitglieder',   icon: '👥', desc: 'Team verwalten' },
            { href: '/dashboard/dept-applications', label: 'Bewerbungen',  icon: '📨', desc: 'Bewerber prüfen' },
          ] : []),
          ...(can.isManagement(role) ? [
            { href: '/dashboard/admin', label: 'Administration', icon: '⚙️', desc: 'Logs & Verwarnungen' },
          ] : []),
        ].map(item => (
          <Link key={item.href} href={item.href}
            className="bg-[#13151f] border border-white/[0.06] hover:border-purple-500/30 rounded-2xl p-4 flex items-center gap-4 transition-all hover:bg-white/[0.02] group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-blue-500/20 border border-purple-500/20 flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform">
              {item.icon}
            </div>
            <div>
              <p className="text-white text-sm font-medium">{item.label}</p>
              <p className="text-gray-600 text-xs">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Profile Info */}
      <div className="bg-[#13151f] border border-white/[0.06] rounded-2xl p-6">
        <h2 className="text-white font-semibold mb-4">👤 Mein Profil</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-500 text-xs mb-1">Benutzername</p>
            <p className="text-white font-medium">{profile?.username}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Rang</p>
            <RoleBadge role={role} />
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Abteilungen</p>
            <div className="flex flex-wrap gap-1.5">
              {depts.length === 0 ? (
                <span className="text-gray-600 text-xs">Keine Abteilung</span>
              ) : depts.map((d: string) => (
                <span key={d} className="text-xs px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {DEPT_LABELS[d]?.replace(/》|《/g,'') || d}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-1">Status</p>
            <span className={`text-xs px-2 py-0.5 rounded-md border ${profile?.is_active ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
              {profile?.is_active ? '● Aktiv' : '○ Inaktiv'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
