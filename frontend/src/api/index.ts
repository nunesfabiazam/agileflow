import api from './client';
import type { Task, KanbanColumn, Sprint, Epic, Project, Document, User, ApiResponse, ImportResult } from '../types';

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login:    (email: string, password: string) => api.post<ApiResponse<{ user: User; token: string }>>('/auth/login', { email, password }),
  register: (data: { name: string; email: string; password: string; role?: string }) => api.post<ApiResponse<{ user: User; token: string }>>('/auth/register', data),
  me:       () => api.get<ApiResponse<User>>('/auth/me'),
};

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projectsApi = {
  list:          () => api.get<ApiResponse<Project[]>>('/projects'),
  get:           (id: string) => api.get<ApiResponse<Project>>(`/projects/${id}`),
  create:        (data: Partial<Project>) => api.post<ApiResponse<Project>>('/projects', data),
  update:        (id: string, data: Partial<Project>) => api.patch<ApiResponse<Project>>(`/projects/${id}`, data),
  addMember:     (id: string, userId: string, role: string) => api.post(`/projects/${id}/members`, { userId, role }),
  removeMember:  (id: string, userId: string) => api.delete(`/projects/${id}/members/${userId}`),
};

// ─── Columns ──────────────────────────────────────────────────────────────────
export const columnsApi = {
  list:    (projectId: string) => api.get<ApiResponse<KanbanColumn[]>>(`/columns?projectId=${projectId}`),
  create:  (data: Partial<KanbanColumn> & { projectId: string }) => api.post<ApiResponse<KanbanColumn>>('/columns', data),
  update:  (id: string, data: Partial<KanbanColumn>) => api.patch<ApiResponse<KanbanColumn>>(`/columns/${id}`, data),
  remove:  (id: string) => api.delete(`/columns/${id}`),
  reorder: (updates: Array<{ id: string; order: number }>) => api.post('/columns/reorder', { updates }),
};

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasksApi = {
  list:           (params: Record<string, string>) => api.get<ApiResponse<Task[]>>('/tasks', { params }),
  get:            (id: string) => api.get<ApiResponse<Task>>(`/tasks/${id}`),
  create:         (data: Partial<Task> & { projectId: string }) => api.post<ApiResponse<Task>>('/tasks', data),
  update:         (id: string, data: Partial<Task> & { assigneeIds?: string[]; criteria?: Array<{ text: string; isDone?: boolean }> }) => api.patch<ApiResponse<Task>>(`/tasks/${id}`, data),
  remove:         (id: string) => api.delete(`/tasks/${id}`),
  reorder:        (updates: Array<{ id: string; columnId: string; order: number }>) => api.post('/tasks/reorder', { updates }),
  addComment:     (id: string, content: string) => api.post(`/tasks/${id}/comments`, { content }),
  updateCriteria: (taskId: string, criterionId: string, isDone: boolean) => api.patch(`/tasks/${taskId}/criteria/${criterionId}`, { isDone }),
  linkDoc:        (taskId: string, documentId: string) => api.post(`/tasks/${taskId}/documents`, { documentId }),
  unlinkDoc:      (taskId: string, documentId: string) => api.delete(`/tasks/${taskId}/documents/${documentId}`),
  addDependency:    (blockerId: string, blockedId: string) => api.post(`/tasks/${blockerId}/dependencies`, { blockedId }),
  removeDependency: (taskId: string, depId: string) => api.delete(`/tasks/${taskId}/dependencies/${depId}`),
};

// ─── Sprints ──────────────────────────────────────────────────────────────────
export const sprintsApi = {
  list:     (projectId: string) => api.get<ApiResponse<Sprint[]>>(`/sprints?projectId=${projectId}`),
  create:   (data: Partial<Sprint> & { projectId: string }) => api.post<ApiResponse<Sprint>>('/sprints', data),
  update:   (id: string, data: Partial<Sprint>) => api.patch<ApiResponse<Sprint>>(`/sprints/${id}`, data),
  start:    (id: string) => api.post(`/sprints/${id}/start`),
  complete: (id: string, moveToSprintId?: string) => api.post(`/sprints/${id}/complete`, { moveToSprintId }),
  remove:   (id: string) => api.delete(`/sprints/${id}`),
};

// ─── Epics ────────────────────────────────────────────────────────────────────
export const epicsApi = {
  list:   (projectId: string) => api.get<ApiResponse<Epic[]>>(`/epics?projectId=${projectId}`),
  create: (data: Partial<Epic> & { projectId: string }) => api.post<ApiResponse<Epic>>('/epics', data),
  update: (id: string, data: Partial<Epic>) => api.patch<ApiResponse<Epic>>(`/epics/${id}`, data),
  remove: (id: string) => api.delete(`/epics/${id}`),
};

// ─── Documents ────────────────────────────────────────────────────────────────
export const documentsApi = {
  listSpaces:   (projectId: string) => api.get(`/documents/spaces?projectId=${projectId}`),
  createSpace:  (data: { name: string; icon?: string; projectId: string }) => api.post('/documents/spaces', data),
  list:         (params: Record<string, string>) => api.get<ApiResponse<Document[]>>('/documents', { params }),
  get:          (id: string) => api.get<ApiResponse<Document>>(`/documents/${id}`),
  create:       (data: Partial<Document> & { projectId: string; taskIds?: string[] }) => api.post<ApiResponse<Document>>('/documents', data),
  update:       (id: string, data: Partial<Document> & { taskIds?: string[] }) => api.patch<ApiResponse<Document>>(`/documents/${id}`, data),
  remove:       (id: string) => api.delete(`/documents/${id}`),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list:   () => api.get<ApiResponse<User[]>>('/users'),
  update: (id: string, data: Partial<User>) => api.patch<ApiResponse<User>>(`/users/${id}`, data),
};

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reportsApi = {
  sprint:  (sprintId: string) => api.get(`/reports/sprint/${sprintId}`),
  project: (projectId: string) => api.get(`/reports/project/${projectId}`),
};

// ─── Search ───────────────────────────────────────────────────────────────────
export const searchApi = {
  search: (q: string, projectId?: string) =>
    api.get<ApiResponse<{ tasks: any[]; documents: any[]; epics: any[] }>>(
      '/search',
      { params: { q, ...(projectId ? { projectId } : {}) } }
    ),
};

// ─── Import ───────────────────────────────────────────────────────────────────
export const importApi = {
  document: (file: File, projectId: string, spaceId?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('projectId', projectId);
    if (spaceId) fd.append('spaceId', spaceId);
    return api.post<ApiResponse<Document>>('/import/document', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  jiraCsv: (file: File, projectId: string) => {
    const fd = new FormData();
    fd.append('file', file); fd.append('projectId', projectId);
    return api.post<ApiResponse<ImportResult>>('/import/jira-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  jiraJson: (file: File, projectId: string) => {
    const fd = new FormData();
    fd.append('file', file); fd.append('projectId', projectId);
    return api.post<ApiResponse<ImportResult>>('/import/jira-json', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  confluenceHtml: (file: File, projectId: string, spaceId?: string) => {
    const fd = new FormData();
    fd.append('file', file); fd.append('projectId', projectId);
    if (spaceId) fd.append('spaceId', spaceId);
    return api.post<ApiResponse<ImportResult>>('/import/confluence-html', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  excelTasks: (file: File, projectId: string) => {
    const fd = new FormData();
    fd.append('file', file); fd.append('projectId', projectId);
    return api.post<ApiResponse<ImportResult>>('/import/excel-tasks', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  templateJiraCsv:  () => window.open('/api/import/template/jira-csv'),
  templateExcel:    () => window.open('/api/import/template/excel'),
};

export const notificationsApi = {
  list:        (params?: { limit?: number; unreadOnly?: boolean }) =>
    api.get('/notifications', { params }),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
  remove:      (id: string) => api.delete(`/notifications/${id}`),
};

// ─── AI ──────────────────────────────────────────────────────────────────────
export const aiApi = {
  assist: (action: string, context: Record<string, any>) =>
    api.post<{ success: boolean; data: { result: string } }>('/ai/assist', { action, context }),
};

export const adminApi = {
  list:   ()                          => api.get('/admin/users'),
  create: (data: Record<string, any>) => api.post('/admin/users', data),
  update: (id: string, data: Record<string, any>) => api.patch(`/admin/users/${id}`, data),
  remove: (id: string)                => api.delete(`/admin/users/${id}`),
};

export const commentsApi = {
  list:   (taskId: string)                              => api.get(`/tasks/${taskId}/comments`),
  create: (taskId: string, text: string, mentions: string[]) =>
    api.post(`/tasks/${taskId}/comments`, { text, mentions }),
  update: (taskId: string, id: string, text: string)   => api.patch(`/tasks/${taskId}/comments/${id}`, { text }),
  remove: (taskId: string, id: string)                 => api.delete(`/tasks/${taskId}/comments/${id}`),
};

export const sprintAnalyticsApi = {
  burndown: (sprintId: string)  => api.get(`/sprints/${sprintId}/burndown`),
  velocity: (projectId: string) => api.get(`/sprints/velocity/${projectId}`),
};
