export type UserRole =
  | 'projektleitung'
  | 'stv_projektleitung'
  | 'manager'
  | 'teamleitung'
  | 'stv_teamleitung'
  | 'head_developer'
  | 'senior_developer'
  | 'developer'
  | 'junior_developer'
  | 'fraktionsmanagement'
  | 'fraktionsverwaltung'
  | 'junior_fraktionsverwaltung'
  | 'head_administrator'
  | 'superadministrator'
  | 'senior_administrator'
  | 'administrator'
  | 'head_moderator'
  | 'senior_moderator'
  | 'moderator'
  | 'head_supporter'
  | 'senior_supporter'
  | 'supporter'
  | 'test_supporter';

export type Department =
  | 'support'
  | 'moderation'
  | 'administration'
  | 'fraktionsmanagement'
  | 'development'
  | 'teamleitung'
  | 'leitungsebene';

export interface Profile {
  id: string;
  username: string;
  role: UserRole;
  departments: Department[];
  is_active: boolean;
  created_at: string;
  last_sign_in_at?: string;
}

export interface Warning {
  id: string;
  user_id: string;
  reason: string;
  created_by: string;
  created_at: string;
  profiles?: any;
  creator?: any;
}

export interface MemberEntry {
  id: string;
  user_id: string;
  type: 'misconduct' | 'positive' | 'other';
  text: string;
  created_by: string;
  created_at: string;
  profiles?: any;
  creator?: any;
}

export interface Absence {
  id: string;
  user_id: string;
  from_date: string;
  to_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by?: string;
  review_note?: string;
  created_at: string;
}

export interface Conference {
  id: string;
  title: string;
  description?: string;
  scheduled_at: string;
  created_by: string;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  created_at: string;
}

export interface Todo {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  created_by: string;
  assigned_to?: string;
  due_date?: string;
  tags?: string[];
  created_at: string;
}
