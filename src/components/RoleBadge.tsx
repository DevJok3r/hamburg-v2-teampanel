'use client';

import { UserRole } from '@/types';
import { ROLE_LABELS } from '@/lib/permissions';

const ROLE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  // Leitungsebene - Pink
  projektleitung:       { bg: 'bg-pink-500/20',   text: 'text-pink-300',   border: 'border-pink-500/40' },
  stv_projektleitung:   { bg: 'bg-pink-500/15',   text: 'text-pink-400',   border: 'border-pink-500/30' },
  manager:              { bg: 'bg-pink-500/10',   text: 'text-pink-400',   border: 'border-pink-500/25' },

  // Teamleitung - Purple
  teamleitung:          { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500/40' },
  stv_teamleitung:      { bg: 'bg-purple-500/15', text: 'text-purple-400', border: 'border-purple-500/30' },

  // Developer - Blue
  head_developer:       { bg: 'bg-blue-500/20',   text: 'text-blue-300',   border: 'border-blue-500/40' },
  senior_developer:     { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/30' },
  developer:            { bg: 'bg-blue-500/10',   text: 'text-blue-400',   border: 'border-blue-500/25' },
  junior_developer:     { bg: 'bg-blue-500/8',    text: 'text-blue-500',   border: 'border-blue-500/20' },

  // Fraktionsmanagement - Violet
  fraktionsmanagement:      { bg: 'bg-violet-500/20', text: 'text-violet-300', border: 'border-violet-500/40' },
  fraktionsverwaltung:      { bg: 'bg-violet-500/15', text: 'text-violet-400', border: 'border-violet-500/30' },
  junior_fraktionsverwaltung: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/25' },

  // Administration - Indigo
  head_administrator:   { bg: 'bg-indigo-500/20', text: 'text-indigo-300', border: 'border-indigo-500/40' },
  superadministrator:   { bg: 'bg-indigo-500/18', text: 'text-indigo-300', border: 'border-indigo-500/35' },
  senior_administrator: { bg: 'bg-indigo-500/15', text: 'text-indigo-400', border: 'border-indigo-500/30' },
  administrator:        { bg: 'bg-indigo-500/10', text: 'text-indigo-400', border: 'border-indigo-500/25' },

  // Moderation - Cyan
  head_moderator:       { bg: 'bg-cyan-500/20',   text: 'text-cyan-300',   border: 'border-cyan-500/40' },
  senior_moderator:     { bg: 'bg-cyan-500/15',   text: 'text-cyan-400',   border: 'border-cyan-500/30' },
  moderator:            { bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/25' },

  // Support - Teal
  head_supporter:       { bg: 'bg-teal-500/20',   text: 'text-teal-300',   border: 'border-teal-500/40' },
  senior_supporter:     { bg: 'bg-teal-500/15',   text: 'text-teal-400',   border: 'border-teal-500/30' },
  supporter:            { bg: 'bg-teal-500/10',   text: 'text-teal-400',   border: 'border-teal-500/25' },
  test_supporter:       { bg: 'bg-gray-500/10',   text: 'text-gray-400',   border: 'border-gray-500/25' },
};

interface Props {
  role: UserRole;
  size?: 'xs' | 'sm' | 'md';
}

export default function RoleBadge({ role, size = 'sm' }: Props) {
  const style = ROLE_STYLES[role] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/25' };
  const label = ROLE_LABELS[role]?.replace('» CDY︱', '') || role;

  const sizeClass = size === 'xs'
    ? 'text-[10px] px-1.5 py-0.5'
    : size === 'sm'
    ? 'text-xs px-2 py-0.5'
    : 'text-sm px-2.5 py-1';

  return (
    <span className={`inline-flex items-center rounded-md border font-medium ${style.bg} ${style.text} ${style.border} ${sizeClass}`}>
      {label}
    </span>
  );
}
