import { UserRole } from '@/types';

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  top_management:          100,
  management:               80,
  junior_management:        80, // gleichgestellt mit management
  senior_moderator:         40,
  senior_developer:         40,
  senior_content_producer:  40,
  senior_event_organizer:   40,
  moderator:                20,
  developer:                20,
  content_producer:         20,
  event_organizer:          20,
  trial_moderator:          10,
  trial_developer:          10,
  trial_content_producer:   10,
  trial_event_organizer:    10,
};

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

// Hilfsfunktion: Ist Staff (Management oder Junior Management)
export function isStaff(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= 80;
}

// Hilfsfunktion: Ist Senior oder höher
export function isSeniorPlus(role: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= 40;
}

export const can = {
  // Benutzerverwaltung
  createUser:      (role: UserRole) => isStaff(role),
  editUser:        (role: UserRole) => isStaff(role),
  deleteUser:      (role: UserRole) => role === 'top_management',
  viewAllUsers:    (role: UserRole) => ROLE_HIERARCHY[role] >= 40, // Senior+
  changePassword:  (role: UserRole) => role === 'top_management',
  changeUsername:  (role: UserRole) => role === 'top_management',
  kickMember:      (role: UserRole) => isStaff(role),
  changeUserRole:  (actorRole: UserRole, targetRole: UserRole): boolean => {
    if (actorRole === 'top_management') return true;
    if (isStaff(actorRole)) return ROLE_HIERARCHY[targetRole] < 80;
    return false;
  },

  // Abmeldungen
  reviewAbsence:   (role: UserRole) => isStaff(role),
  deleteAbsence:   (role: UserRole) => isStaff(role),
  viewAllAbsences: (role: UserRole) => true, // alle können sehen

  // Todos
  viewAllTodos:    (role: UserRole) => isStaff(role),

  // Einträge & Verwarnungen
  manageEntries:   (role: UserRole) => isStaff(role),
  deleteEntries:   (role: UserRole) => isStaff(role),
  warnMember:      (role: UserRole) => isStaff(role),

  // Konferenzen
  manageConferences: (role: UserRole) => isStaff(role),

  // Leistungsbewertungen
  manageEvaluations: (role: UserRole) => isStaff(role),

  // Administration
  viewAdmin:       (role: UserRole) => isStaff(role),
  viewAuditLog:    (role: UserRole) => role === 'top_management',
  manageLogs:      (role: UserRole) => role === 'top_management',

  // Webhooks & Automationen
  manageWebhooks:  (role: UserRole) => role === 'top_management',

  // Bewerbungen
  viewApplications: (role: UserRole) => isStaff(role),
};

export const ROLE_LABELS: Record<UserRole, string> = {
  top_management:          'Top Management',
  management:              'Management',
  junior_management:       'Junior Management',
  senior_moderator:        'Senior Moderator',
  senior_developer:        'Senior Developer',
  senior_content_producer: 'Senior Content Producer',
  senior_event_organizer:  'Senior Event Organizer',
  moderator:               'Moderator',
  developer:               'Developer',
  content_producer:        'Content Producer',
  event_organizer:         'Event Organizer',
  trial_moderator:         'Trial Moderator',
  trial_developer:         'Trial Developer',
  trial_content_producer:  'Trial Content Producer',
  trial_event_organizer:   'Trial Event Organizer',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  top_management:          'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  management:              'bg-red-500/20 text-red-400 border-red-500/30',
  junior_management:       'bg-orange-500/20 text-orange-400 border-orange-500/30',
  senior_moderator:        'bg-blue-500/20 text-blue-400 border-blue-500/30',
  senior_developer:        'bg-green-500/20 text-green-400 border-green-500/30',
  senior_content_producer: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  senior_event_organizer:  'bg-pink-500/20 text-pink-400 border-pink-500/30',
  moderator:               'bg-blue-400/20 text-blue-300 border-blue-400/30',
  developer:               'bg-green-400/20 text-green-300 border-green-400/30',
  content_producer:        'bg-purple-400/20 text-purple-300 border-purple-400/30',
  event_organizer:         'bg-pink-400/20 text-pink-300 border-pink-400/30',
  trial_moderator:         'bg-gray-500/20 text-gray-400 border-gray-500/30',
  trial_developer:         'bg-gray-500/20 text-gray-400 border-gray-500/30',
  trial_content_producer:  'bg-gray-500/20 text-gray-400 border-gray-500/30',
  trial_event_organizer:   'bg-gray-500/20 text-gray-400 border-gray-500/30',
};