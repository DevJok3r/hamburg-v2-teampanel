import { UserRole } from '@/types';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  top_management:   100,
  management:        80,
  junior_management: 60,
  moderation_team:   20,
  development_team:  20,
  social_media_team: 20,
  event_team:        20,
};

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

export const can = {
  createUser:      (role: UserRole) => hasMinRole(role, 'management'),
  editUser:        (role: UserRole) => hasMinRole(role, 'management'),
  deleteUser:      (role: UserRole) => role === 'top_management',
  viewAllUsers:    (role: UserRole) => hasMinRole(role, 'junior_management'),
  changePassword:  (role: UserRole) => role === 'top_management',
  reviewAbsence:   (role: UserRole) => hasMinRole(role, 'management'),
  viewAllAbsences: (role: UserRole) => hasMinRole(role, 'junior_management'),
  viewAllTodos:    (role: UserRole) => hasMinRole(role, 'junior_management'),
  manageEntries:   (role: UserRole) => hasMinRole(role, 'junior_management'),
  deleteEntries:   (role: UserRole) => hasMinRole(role, 'management'),
  warnMember:      (role: UserRole) => hasMinRole(role, 'junior_management'),
  kickMember:      (role: UserRole) => hasMinRole(role, 'management'),
  viewAdmin:       (role: UserRole) => hasMinRole(role, 'junior_management'),
  viewAuditLog:    (role: UserRole) => role === 'top_management',
  changeUserRole:  (actorRole: UserRole, targetRole: UserRole): boolean => {
    if (actorRole === 'top_management') return true;
    if (actorRole === 'management') {
      return ROLE_HIERARCHY[targetRole] < ROLE_HIERARCHY['management'];
    }
    return false;
  },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  top_management:   'Top Management',
  management:       'Management',
  junior_management:'Junior Management',
  moderation_team:  'Moderation Team',
  development_team: 'Development Team',
  social_media_team:'Social Media Team',
  event_team:       'Event Team',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  top_management:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  management:       'bg-red-500/20 text-red-400 border-red-500/30',
  junior_management:'bg-orange-500/20 text-orange-400 border-orange-500/30',
  moderation_team:  'bg-blue-500/20 text-blue-400 border-blue-500/30',
  development_team: 'bg-green-500/20 text-green-400 border-green-500/30',
  social_media_team:'bg-purple-500/20 text-purple-400 border-purple-500/30',
  event_team:       'bg-pink-500/20 text-pink-400 border-pink-500/30',
};
