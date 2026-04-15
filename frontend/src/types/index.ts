// ─── Enums ────────────────────────────────────────────────────────────────────
export type UserRole = 'ADMIN' | 'PM' | 'DEVELOPER' | 'QA' | 'UX' | 'SCRUM_MASTER' | 'STAKEHOLDER' | 'VIEWER';
export type TaskType = 'STORY' | 'BUG' | 'TASK' | 'SPIKE' | 'EPIC' | 'SUBTASK';
export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
export type DocType = 'SPEC' | 'DIAGRAM' | 'DESIGN' | 'REFERENCE' | 'TEMPLATE' | 'TEST_PLAN' | 'WIREFRAME' | 'RUNBOOK' | 'OTHER';

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  color: string;
  avatarUrl?: string;
  createdAt?: string;
}

// ─── Project ──────────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  description?: string;
  key: string;
  color: string;
  iconEmoji: string;
  isArchived: boolean;
  owner: Pick<User, 'id' | 'name' | 'color'>;
  members?: ProjectMember[];
  kanbanColumns?: KanbanColumn[];
  _count?: { tasks: number; members: number; sprints: number; };
}

export interface ProjectMember {
  userId: string;
  role: UserRole;
  user: Pick<User, 'id' | 'name' | 'color' | 'role' | 'avatarUrl'>;
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
export interface KanbanColumn {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
  projectId: string;
  _count?: { tasks: number };
}

// ─── Sprint ───────────────────────────────────────────────────────────────────
export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  status: SprintStatus;
  startDate?: string;
  endDate?: string;
  velocity?: number;
  projectId: string;
  totalPoints?: number;
  completedPoints?: number;
  _count?: { tasks: number };
}

// ─── Epic ─────────────────────────────────────────────────────────────────────
export interface Epic {
  id: string;
  title: string;
  description?: string;
  color: string;
  startDate?: string;
  dueDate?: string;
  projectId: string;
  totalTasks?: number;
  completedTasks?: number;
  progress?: number;
}

// ─── Task ─────────────────────────────────────────────────────────────────────
export interface AcceptanceCriteria {
  id: string;
  text: string;
  isDone: boolean;
  order: number;
}

export interface TaskComment {
  id: string;
  content: string;
  createdAt: string;
  author: Pick<User, 'id' | 'name' | 'color' | 'avatarUrl'>;
}

export interface Task {
  id: string;
  taskKey: string;
  title: string;
  description?: string;
  type: TaskType;
  priority: TaskPriority;
  storyPoints?: number;
  dueDate?: string;
  isClosed: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  column?: Pick<KanbanColumn, 'id' | 'name' | 'color'>;
  sprint?: Pick<Sprint, 'id' | 'name'>;
  epic?: Pick<Epic, 'id' | 'title' | 'color'>;
  creator: Pick<User, 'id' | 'name' | 'color'>;
  assignees: Array<{ user: Pick<User, 'id' | 'name' | 'color' | 'avatarUrl'> }>;
  criteria: AcceptanceCriteria[];
  comments?: TaskComment[];
  documents?: Array<{ document: Pick<Document, 'id' | 'title' | 'type'> }>;
  subtasks?: Array<Pick<Task, 'id' | 'taskKey' | 'title' | 'type' | 'priority'> & { column?: Pick<KanbanColumn, 'name'> }>;
  _count?: { comments: number; subtasks: number; documents: number };
}

// ─── Document ─────────────────────────────────────────────────────────────────
export interface DocSpace {
  id: string;
  name: string;
  icon: string;
  order: number;
  _count?: { documents: number };
}

export interface Document {
  id: string;
  title: string;
  content?: string;
  type: DocType;
  version: number;
  createdAt: string;
  updatedAt: string;
  space?: Pick<DocSpace, 'id' | 'name'>;
  author: Pick<User, 'id' | 'name' | 'color'>;
  linkedTasks?: Array<{ task: Pick<Task, 'id' | 'taskKey' | 'title'> }>;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: { total: number; page: number; limit: number; totalPages: number };
}

export interface ImportResult {
  created: number;
  skipped?: number;
}
