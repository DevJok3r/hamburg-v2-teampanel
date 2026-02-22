import { requireAuth } from '@/lib/auth';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { can, ROLE_LABELS } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';
import { Profile } from '@/types';
import Link from 'next/link';

export default async function DashboardPage() {
  const profile = await requireAuth();
  const supabase = await createServerSupabaseClient();

  const { data: members } = await supabase
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('role')
    .order('username');

  const totalMembers = members?.length ?? 0;
  const roleCount = members?.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pendingAbsences = can.viewAllAbsences(profile.role)
    ? await supabase
        .from('absences')
        .select('*')
        .eq('status', 'pending')
    : { data: null };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Willkommen zurück, <span className="text-blue-400 font-medium">{profile.username}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Gesamt Mitglieder"
          value={totalMembers}
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          color="blue"
        />
        <StatCard
          label="Offene Abmeldungen"
          value={pendingAbsences.data?.length ?? '—'}
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          color="yellow"
        />
        <StatCard
          label="Management"
          value={(roleCount?.['top_management'] || 0) + (roleCount?.['management'] || 0)}
          icon="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04"
          color="purple"
        />
        <StatCard
          label="Deine Rolle"
          value={ROLE_LABELS[profile.role]}
          icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          color="green"
          small
        />
      </div>

      <div className="bg-[#1a1d27] border border-white/10 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-white font-semibold">Team Mitglieder</h2>
          {can.createUser(profile.role) && (
            <Link
              href="/dashboard/users/new"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium
                         px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Mitglied hinzufügen
            </Link>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Benutzer</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Rolle</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Letzter Login</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase tracking-wider px-6 py-3">Dabei seit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {members?.map((member: Profile) => (
                <tr key={member.id} className="hover:bg-white/2 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full
                                      flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-white text-sm font-medium">{member.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {member.last_sign_in_at
                      ? new Date(member.last_sign_in_at).toLocaleString('de-DE', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })
                      : 'Noch nie'}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {new Date(member.created_at).toLocaleDateString('de-DE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, color, small
}: {
  label: string;
  value: number | string;
  icon: string;
  color: 'blue' | 'yellow' | 'purple' | 'green';
  small?: boolean;
}) {
  const colorMap = {
    blue:   'bg-blue-500/10 text-blue-400',
    yellow: 'bg-yellow-500/10 text-yellow-400',
    purple: 'bg-purple-500/10 text-purple-400',
    green:  'bg-green-500/10 text-green-400',
  };

  return (
    <div className="bg-[#1a1d27] border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-gray-400 text-sm">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
          </svg>
        </div>
      </div>
      <p className={`font-bold text-white ${small ? 'text-base' : 'text-3xl'}`}>{value}</p>
    </div>
  );
}