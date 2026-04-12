'use client';

import { useState, useEffect } from 'react';
import { createClientSupabaseClient } from '@/lib/supabase/client';
import { Profile, UserRole, MemberEntry, Warning } from '@/types';
import { can, ROLE_LABELS, ROLE_HIERARCHY } from '@/lib/permissions';
import RoleBadge from '@/components/RoleBadge';

type EntryType = 'misconduct' | 'achievement';

export default function TeamPage() {
  const [members, setMembers]               = useState<Profile[]>([]);
  const [myRole, setMyRole]                 = useState<UserRole | null>(null);
  const [myId, setMyId]                     = useState('');
  const [loading, setLoading]               = useState(true);

  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [entries, setEntries]               = useState<MemberEntry[]>([]);
  const [warnings, setWarnings]             = useState<Warning[]>([]);

  const [showEntryForm, setShowEntryForm]   = useState(false);
  const [showWarnForm, setShowWarnForm]     = useState(false);
  const [showKickConfirm, setShowKickConfirm] = useState(false);
  const [showRoleForm, setShowRoleForm]     = useState(false);
  const [showAbsenceForm, setShowAbsenceForm] = useState(false);

  const [entryForm, setEntryForm] = useState({ type: 'misconduct' as EntryType, text: '' });
  const [warnForm, setWarnForm]   = useState({ reason: '' });

  const [selectedRole, setSelectedRole] = useState<UserRole>('moderator');

  const [absenceForm, setAbsenceForm] = useState({
    from_date: '',
    to_date: '',
    reason: ''
  });

  const supabase = createClientSupabaseClient();

  const isTopManagement = myRole ? ['projektleitung', 'stv_projektleitung'].includes(myRole) : false;

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setMyId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) setMyRole(profile.role as UserRole);

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', true)
      .order('role')
      .order('username');

    setMembers(data || []);
    setLoading(false);
  }

  async function loadMemberDetails(memberId: string) {
    const { data: e } = await supabase
      .from('member_entries')
      .select('*, creator:created_by(username)')
      .eq('user_id', memberId)
      .order('created_at', { ascending: false });

    const { data: w } = await supabase
      .from('warnings')
      .select('*, creator:created_by(username)')
      .eq('user_id', memberId)
      .order('created_at', { ascending: false });

    setEntries(e || []);
    setWarnings(w || []);
  }

  useEffect(() => { load(); }, []);

  async function openMember(member: Profile) {
    setSelectedMember(member);
    setSelectedRole(member.role);

    setShowEntryForm(false);
    setShowWarnForm(false);
    setShowKickConfirm(false);
    setShowRoleForm(false);
    setShowAbsenceForm(false);

    if (myRole && can.viewAllUsers(myRole)) {
      await loadMemberDetails(member.id);
    }
  }

  async function addEntry() {
    if (!entryForm.text.trim() || !selectedMember) return;

    await supabase.from('member_entries').insert({
      user_id: selectedMember.id,
      type: entryForm.type,
      text: entryForm.text,
      created_by: myId
    });

    setEntryForm({ type: 'misconduct', text: '' });
    setShowEntryForm(false);
    await loadMemberDetails(selectedMember.id);
  }

  async function addWarning() {
    if (!warnForm.reason.trim() || !selectedMember) return;

    await supabase.from('warnings').insert({
      user_id: selectedMember.id,
      reason: warnForm.reason,
      created_by: myId
    });

    setWarnForm({ reason: '' });
    setShowWarnForm(false);
    await loadMemberDetails(selectedMember.id);
  }

  async function deleteEntry(id: string) {
    await supabase.from('member_entries').delete().eq('id', id);
    if (selectedMember) await loadMemberDetails(selectedMember.id);
  }

  async function deleteWarning(id: string) {
    await supabase.from('warnings').delete().eq('id', id);
    if (selectedMember) await loadMemberDetails(selectedMember.id);
  }

  async function kickMember() {
    if (!selectedMember) return;

    await supabase
      .from('profiles')
      .update({ is_active: false })
      .eq('id', selectedMember.id);

    setSelectedMember(null);
    setShowKickConfirm(false);
    load();
  }

  async function changeRole() {
    if (!selectedMember || !myRole) return;

    if (!isTopManagement && ROLE_HIERARCHY[selectedRole] >= ROLE_HIERARCHY[myRole]) return;

    await supabase
      .from('profiles')
      .update({ role: selectedRole })
      .eq('id', selectedMember.id);

    setSelectedMember({ ...selectedMember, role: selectedRole });
    setShowRoleForm(false);
    load();
  }

  async function addAbsence() {
    if (!selectedMember) return;

    await supabase.from('absences').insert({
      user_id: selectedMember.id,
      ...absenceForm
    });

    setAbsenceForm({ from_date: '', to_date: '', reason: '' });
    setShowAbsenceForm(false);
  }

  function canActOn(targetRole: UserRole) {
    if (!myRole) return false;
    if (isTopManagement) return true;

    return ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[targetRole];
  }

  const canManage     = myRole ? can.viewAllUsers(myRole) : false;
  const canKick       = myRole && isTopManagement;
  const canChangeRole = myRole ? can.changeUserRole(myRole, selectedRole || 'moderator') : false;

  const allRoles: UserRole[] = Object.keys(ROLE_HIERARCHY) as UserRole[];

  if (loading) return <div className="text-gray-400 text-center py-12">Lade...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Team Übersicht</h1>
        <p className="text-gray-400 text-sm mt-1">{members.length} aktive Mitglieder</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {members.map(member => (
          <div key={member.id}
            onClick={() => openMember(member)}
            className="bg-[#1a1d27] border border-white/10 rounded-xl p-5 cursor-pointer hover:border-blue-500/30 hover:bg-[#1e2130] transition">

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                {member.username.charAt(0).toUpperCase()}
              </div>

              <div>
                <p className="text-white font-medium">{member.username}</p>
                <RoleBadge role={member.role} size="xs" />
              </div>
            </div>

            <div className="text-xs text-gray-500">
              Dabei seit: {new Date(member.created_at).toLocaleDateString('de-DE')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}