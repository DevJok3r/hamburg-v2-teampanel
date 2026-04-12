'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { UserRole } from '@/types';
import { can, ROLE_LABELS } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  show: boolean;
}

interface Profile {
  id: string;
  username: string;
  role: UserRole;
  departments: string[];
  is_active: boolean;
}

export default function Sidebar() {
  const pathname  = usePathname();
  const supabase  = createClientSupabaseClient();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
      setLoading(false);
    }
    load();
  }, []);

  if (loading || !profile) return (
    <div className="w-64 min-h-screen bg-[#0d0e14] border-r border-white/[0.06] flex flex-col">
      <div className="p-5 border-b border-white/[0.06]">
        <div className="h-8 bg-white/5 rounded-lg animate-pulse" />
      </div>
    </div>
  );

  const role = profile.role as UserRole;
  const depts = profile.departments || [];
  const isTop = can.isTopManagement(role);
  const isMgmt = can.isManagement(role);
  const isSenior = can.isSenior(role);
  const isAdmin = role === 'projektleitung';

  const navItems: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      show: true,
    },
    {
      href: '/dashboard/users',
      label: 'Mitglieder',
      icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
      show: isSenior,
    },
    {
      href: '/dashboard/absences',
      label: 'Abmeldungen',
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      show: true,
    },
    {
      href: '/dashboard/conferences',
      label: 'Konferenzen',
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
      show: true,
    },
    {
      href: '/dashboard/todos',
      label: 'Aufgaben',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
      show: true,
    },
    {
      href: '/dashboard/requests',
      label: 'Anträge',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      show: false, // Entfernt für CandyLife
    },
    {
      href: '/dashboard/dept-applications',
      label: 'Bewerbungen',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      show: isSenior,
    },
    {
      href: '/dashboard/admin',
      label: 'Administration',
      icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4',
      show: isMgmt,
    },
    {
      href: '/dashboard/logs',
      label: 'System Logs',
      icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      show: isTop,
    },
    {
      href: '/dashboard/bot',
      label: 'Bot Dashboard',
      icon: 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
      show: profile.username === 'jxkerlds',
    },
  ];

  const visibleItems = navItems.filter(item => item.show);

  return (
    <div className="w-64 min-h-screen bg-[#0d0e14] border-r border-white/[0.06] flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-sm">C</span>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">CandyLife</p>
            <p className="text-gray-600 text-xs">Staff Portal</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-blue-500/20 text-white border border-purple-500/30'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-white/[0.04]'
              }`}>
              <svg className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-purple-400' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="bg-white/[0.03] rounded-xl p-3">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {profile.username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{profile.username}</p>
              <p className="text-gray-600 text-xs truncate">{ROLE_LABELS[role]?.replace('» CDY︱','')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/profile"
              className="flex-1 text-center text-xs text-gray-500 hover:text-gray-300 bg-white/5 hover:bg-white/10 rounded-lg py-1.5 transition">
              Profil
            </Link>
            <button
              onClick={async () => {
                const supabase = createClientSupabaseClient();
                await supabase.auth.signOut();
                window.location.href = '/';
              }}
              className="flex-1 text-center text-xs text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg py-1.5 transition">
              Abmelden
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
