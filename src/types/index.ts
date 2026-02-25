export type UserRole =
  | 'top_management'
  | 'management'
  | 'junior_management'
  | 'senior_moderator'
  | 'senior_developer'
  | 'senior_content_producer'
  | 'senior_event_organizer'
  | 'moderator'
  | 'developer'
  | 'content_producer'
  | 'event_organizer'
  | 'trial_moderator'
  | 'trial_developer'
  | 'trial_content_producer'
  | 'trial_event_organizer';

export type TeamLeadDepartment = 'moderation' | 'development' | 'social_media' | 'event';
export type AbsenceStatus = 'pending' | 'approved' | 'rejected';
export type ConferenceStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type AttendanceStatus = 'present' | 'excused' | 'absent';
export type EntryType = 'misconduct' | 'positive' | 'other';
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  username: string;
  role: UserRole;
  team_lead_department: TeamLeadDepartment | null;
  created_at: string;
  last_sign_in_at: string | null;
  is_active: boolean;
  created_by: string | null;
}

export interface Absence {
  id: string;
  user_id: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: AbsenceStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profiles?: Pick<Profile, 'username' | 'role'>;
}

export interface Conference {
  id: string;
  title: string;
  description: string | null;
  scheduled_at: string;
  status: ConferenceStatus;
  created_by: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
  conference_type: string;
  target_roles: string[];
  extra_user_ids: string[];
  profiles?: Pick<Profile, 'username' | 'role'>;
}

export interface ConferenceAttendance {
  id: string;
  conference_id: string;
  user_id: string;
  status: AttendanceStatus;
  note: string | null;
  created_at: string;
  profiles?: Pick<Profile, 'username' | 'role'>;
}

export interface MemberEntry {
  id: string;
  user_id: string;
  type: EntryType;
  text: string;
  created_by: string;
  created_at: string;
  profiles?: Pick<Profile, 'username' | 'role'>;
  creator?: Pick<Profile, 'username'>;
}

export interface Warning {
  id: string;
  user_id: string;
  reason: string;
  created_by: string;
  created_at: string;
  profiles?: Pick<Profile, 'username' | 'role'>;
  creator?: Pick<Profile, 'username'>;
}

export interface TeamApplication {
  id: string;
  applicant_id: string;
  partner_name: string;
  reason: string;
  experience: string;
  availability: string;
  status: ApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  profiles?: Pick<Profile, 'username' | 'role'>;
}

export interface Todo {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}