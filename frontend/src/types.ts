export type Role = 'user' | 'admin';
export type Visibility = 'draft' | 'public' | 'restricted';
export type GroupType = 'group' | 'class';
export type MemberStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface AdminUser extends User {
  attempt_count: number;
  groups: string | null;
}

export interface Option {
  text: string;
  image: string | null;
}

export interface ExamListItem {
  id: number;
  title: string;
  description: string;
  duration_minutes: number;
  visibility: Visibility;
  max_attempts: number;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  question_count: number;
  my_attempts: number;
  my_best: number | null;
  in_progress_id: number | null;
  via_groups: string | null;
}

export interface AttemptRow {
  id: number;
  exam_id: number;
  exam_title?: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
  correct_count: number | null;
  total_count: number | null;
  score10: number | null;
  user_id?: number;
  username?: string;
  full_name?: string;
}

export interface ExamDetail {
  id: number;
  title: string;
  description: string;
  duration_minutes: number;
  visibility: Visibility;
  max_attempts: number;
  show_answers: boolean;
  start_at: string | null;
  end_at: string | null;
  question_count: number;
  total_points: number;
  attempts: AttemptRow[];
}

export interface AttemptQuestion {
  id: number;
  no: number;
  content: string;
  image_url: string | null;
  options: Option[];
  points: number;
  selected?: number;
  is_correct?: boolean;
  correct_index?: number;
  explanation?: string;
  explanation_image?: string | null;
}

export interface AttemptView {
  id: number;
  exam: { id: number; title: string; show_answers: boolean };
  started_at: string;
  deadline_at: string;
  submitted_at: string | null;
  server_now: string;
  score: number | null;
  max_score: number | null;
  score10: number | null;
  correct_count: number | null;
  total_count: number | null;
  questions: AttemptQuestion[];
}

export interface History {
  summary: { total_attempts: number; exams_taken: number; average10: number | null; best10: number | null };
  attempts: AttemptRow[];
}

export interface UserGroup {
  id: number;
  name: string;
  description: string;
  type: GroupType;
  open: boolean;
  member_count: number;
  exam_count: number;
  my_status: MemberStatus | null;
}

export interface AdminGroup {
  id: number;
  name: string;
  description: string;
  type: GroupType;
  open: boolean;
  created_at: string;
  member_count: number;
  pending_count: number;
  exam_count: number;
}

export interface GroupMemberRow {
  id: number;
  username: string;
  full_name: string;
  email: string;
  status: MemberStatus;
  requested_at: string;
  decided_at: string | null;
}

export interface GroupDetail {
  group: AdminGroup;
  members: GroupMemberRow[];
  exams: { id: number; title: string; visibility: Visibility }[];
}

export interface JoinRequest {
  group_id: number;
  user_id: number;
  requested_at: string;
  group_name: string;
  group_type: GroupType;
  username: string;
  full_name: string;
  email: string;
}

export interface Stats {
  users: number;
  admins: number;
  exams: number;
  published: number;
  groups: number;
  pending: number;
  attempts: number;
}

export interface AdminExamRow {
  id: number;
  title: string;
  visibility: Visibility;
  duration_minutes: number;
  max_attempts: number;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  question_count: number;
  attempt_count: number;
  group_names: string | null;
  user_count: number;
}

export interface EditQuestion {
  id?: number;
  key: string; // khoá React ổn định
  content: string;
  image_url: string | null;
  options: Option[];
  correct_index: number;
  points: number;
  explanation: string;
  explanation_image: string | null;
}

export interface AdminExam {
  id: number;
  title: string;
  description: string;
  duration_minutes: number;
  visibility: Visibility;
  max_attempts: number;
  shuffle: boolean;
  show_answers: boolean;
  start_at: string | null;
  end_at: string | null;
  questions: Omit<EditQuestion, 'key'>[];
  group_ids: number[];
  users: { id: number; username: string; full_name: string }[];
}

export interface ExamResults {
  exam: { id: number; title: string };
  summary: { attempts: number; users: number; average10: number | null; max10: number | null; min10: number | null };
  attempts: AttemptRow[];
}
