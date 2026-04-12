import { UserRole } from '@/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  projektleitung: '» CDY︱Projektleitung',
  stv_projektleitung: '» CDY︱Stv. Projektleitung',
  manager: '» CDY︱Manager',
  teamleitung: '» CDY︱Teamleitung',
  stv_teamleitung: '» CDY︱Stv. Teamleitung',

  head_developer: '» CDY︱Head Developer',
  senior_developer: '» CDY︱Senior Developer',
  developer: '» CDY︱Developer',
  junior_developer: '» CDY︱Junior Developer',

  fraktionsmanagement: '» CDY︱Fraktionsmanagement',
  fraktionsverwaltung: '» CDY︱Fraktionsverwaltung',
  junior_fraktionsverwaltung: '» CDY︱Junior Fraktionsverwaltung',

  head_administrator: '» CDY︱Head Administrator',
  superadministrator: '» CDY︱Superadministrator',
  senior_administrator: '» CDY︱Senior Administrator',
  administrator: '» CDY︱Administrator',

  head_moderator: '» CDY︱Head Moderator',
  senior_moderator: '» CDY︱Senior Moderator',
  moderator: '» CDY︱Moderator',

  head_supporter: '» CDY︱Head Supporter',
  senior_supporter: '» CDY︱Senior Supporter',
  supporter: '» CDY︱Supporter',
  test_supporter: '» CDY︱Test Supporter',
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  projektleitung: 100,
  stv_projektleitung: 95,
  manager: 90,
  teamleitung: 85,
  stv_teamleitung: 80,

  head_developer: 75,
  senior_developer: 70,
  developer: 65,
  junior_developer: 60,

  fraktionsmanagement: 75,
  fraktionsverwaltung: 65,
  junior_fraktionsverwaltung: 55,

  head_administrator: 75,
  superadministrator: 72,
  senior_administrator: 70,
  administrator: 60,

  head_moderator: 55,
  senior_moderator: 50,
  moderator: 45,

  head_supporter: 40,
  senior_supporter: 35,
  supporter: 30,
  test_supporter: 20,
};

export const DEPT_LABELS: Record<string, string> = {
  support: '》Support《',
  moderation: '》Moderation《',
  administration: '》Administration《',
  fraktionsmanagement: '》Fraktionsmanagement《',
  development: '》Development《',
  teamleitung: '》Teamleitung《',
  leitungsebene: '》Leitungsebene《',
};

// ---------- SAFE HELPERS ----------

export function getRoleLevel(role: UserRole | null | undefined): number {
  if (!role) return 0;
  return ROLE_HIERARCHY[role];
}

// ---------- ROLE GROUPS ----------

const TOP_ROLES: UserRole[] = [
  'projektleitung',
  'stv_projektleitung',
  'manager',
];

const MANAGEMENT_ROLES: UserRole[] = [
  ...TOP_ROLES,
  'teamleitung',
  'stv_teamleitung',
];

const SENIOR_ROLES: UserRole[] = [
  ...MANAGEMENT_ROLES,
  'head_developer',
  'head_administrator',
  'head_moderator',
  'head_supporter',
  'superadministrator',
  'fraktionsmanagement',
];

// ---------- PERMISSIONS ----------

export const can = {
  viewAdmin: (role: UserRole) => SENIOR_ROLES.includes(role),

  viewAllUsers: (role: UserRole) => SENIOR_ROLES.includes(role),

  changeUserRole: (myRole: UserRole, targetRole: UserRole) =>
    getRoleLevel(myRole) > getRoleLevel(targetRole),

  deleteEntries: (role: UserRole) => MANAGEMENT_ROLES.includes(role),

  manageAbsences: (role: UserRole) => SENIOR_ROLES.includes(role),

  manageConferences: (role: UserRole) => SENIOR_ROLES.includes(role),

  viewApplications: (role: UserRole) => SENIOR_ROLES.includes(role),

  manageApplications: (role: UserRole) => MANAGEMENT_ROLES.includes(role),

  isTopManagement: (role: UserRole) => TOP_ROLES.includes(role),

  isManagement: (role: UserRole) => MANAGEMENT_ROLES.includes(role),

  isSenior: (role: UserRole) => SENIOR_ROLES.includes(role),
};

// optional alias (falls du es irgendwo nutzt)
export const isStaff = (role: UserRole) =>
  MANAGEMENT_ROLES.includes(role);