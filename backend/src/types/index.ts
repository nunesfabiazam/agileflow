import { Request } from 'express';

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: AuthPayload;
}

export type UserRole = 'ADMIN' | 'PM' | 'DEVELOPER' | 'QA' | 'UX' | 'SCRUM_MASTER' | 'STAKEHOLDER' | 'VIEWER';

export type TaskType = 'STORY' | 'BUG' | 'TASK' | 'SPIKE' | 'EPIC' | 'SUBTASK';
export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type TaskStatus = string; // dynamic — based on project's KanbanColumn

export type SprintStatus = 'PLANNING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
