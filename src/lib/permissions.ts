import { UserRole } from '@/types';

export const ROLE_LABELS: Record<UserRole, string> = {
  projektleitung:           '» CDY︱Projektleitung',
  stv_projektleitung:       '» CDY︱Stv. Projektleitung',
  manager:                  '» CDY︱Manager',
  teamleitung:              '» CDY︱Teamleitung',
  stv_teamleitung:          '» CDY︱Stv. Teamleitung',
  head_developer:           '» CDY︱Head Developer',
  senior_developer:         '» CDY︱Senior Developer',
  developer:                '» CDY︱Developer',
  junior_developer:         '» CDY︱Junior Developer',
  fraktionsmanagement:      '» CDY︱Fraktionsmanagement',
  fraktionsverwaltung:      '» CDY︱Fraktionsverwaltung',
  junior_fraktionsverwaltung: '» CDY︱Junior Fraktionsverwaltung',
  head_administrator:       '» CDY︱Head Administrator',
  superadministrator:       '» CDY︱Superadministrator',
  senior_administrator:     '» CDY︱Senior Administrator',
  administrator:            '» CDY︱Administrator',
  head_moderator:           '» CDY︱Head Moderator',
  senior_moderator:         '» CDY︱Senior Moderator',
  moderator:                '» CDY︱Moderator',
  head_supporter:           '» CDY︱Head Supporter',
  senior_supporter:         '» CDY︱Senior Supporter',
  supporter:                '» CDY︱Supporter',
  test_supporter:           '» CDY︱Test Supporter',
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  projektleitung:             100,
  stv_projektleitung:         95,
  manager:                    90,
  teamleitung:                85,
  stv_teamleitung:            80,
  head_developer:             75,
  senior_developer:           70,
  developer:                  65,
  junior_developer:           60,
  fraktionsmanagement:        75,
  fraktionsverwaltung:        65,
  junior_fraktionsverwaltung: 55,
  head_administrator:         75,
  superadministrator:         70,
  senior_administrator:       65,
  administrator:              60,
  head_moderator:             55,
  senior_moderator:           50,
  moderator:                  45,
  head_supporter:             40,
  senior_supporter:           35,
  supporter:                  30,
  test_supporter:             20,
};

export const DEPT_LABELS: Record<string, string> = {
  support:              '》Support《',
  moderation:           '》Moderation《',
  administration:       '》Administration《',
  fraktionsmanagement:  '》Fraktionsmanagement《',
  development:          '》Development《',
  teamleitung:          '》Teamleitung《',
  leitungsebene:        '》Leitungsebene《',
};

// Top level = Projektleitung + Stv. Projektleitung + Manager
const TOP = (role: UserRole) => ['projektleitung','stv_projektleitung','manager'].includes(role);
// Management level = TOP + Teamleitung + Stv. Teamleitung
const MGMT = (role: UserRole) => TOP(role) || ['teamleitung','stv_teamleitung'].includes(role);
// Senior level = MGMT + all Head roles + Super
const SENIOR = (role: UserRole) => MGMT(role) || ['head_developer','head_administrator','head_moderator','head_supporter','superadministrator','fraktionsmanagement'].includes(role);

export const can = {
  viewAdmin:        (role: UserRole) => MGMT(role),
  viewAllUsers:     (role: UserRole) => SENIOR(role),
  changeUserRole:   (myRole: UserRole, targetRole: UserRole) => ROLE_HIERARCHY[myRole] > ROLE_HIERARCHY[targetRole],
  deleteEntries:    (role: UserRole) => MGMT(role),
  manageAbsences:   (role: UserRole) => SENIOR(role),
  manageConferences:(role: UserRole) => SENIOR(role),
  viewApplications: (role: UserRole) => SENIOR(role),
  manageApplications:(role: UserRole) => MGMT(role),
  isTopManagement:  (role: UserRole) => TOP(role),
  isManagement:     (role: UserRole) => MGMT(role),
  isSenior:         (role: UserRole) => SENIOR(role),
};
