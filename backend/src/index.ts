import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import authRoutes from './routes/auth';
import projectRoutes from './routes/projects';
import taskRoutes from './routes/tasks';
import sprintRoutes from './routes/sprints';
import epicRoutes from './routes/epics';
import columnRoutes from './routes/columns';
import documentRoutes from './routes/documents';
import userRoutes from './routes/users';
import importRoutes from './routes/imports';
import reportRoutes from './routes/reports';
import searchRoutes from './routes/search';
import notificationRoutes from './routes/notifications';
import adminUsersRouter from './routes/adminUsers';
import commentsRouter from './routes/comments';
import sprintAnalyticsRouter from './routes/sprintAnalytics';
import timeLogsRouter, { timeReportRouter } from './routes/timeLogs';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));

app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/projects',  projectRoutes);
app.use('/api/tasks',     taskRoutes);
app.use('/api/sprints',   sprintRoutes);
app.use('/api/epics',     epicRoutes);
app.use('/api/columns',   columnRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/import',    importRoutes);
app.use('/api/reports',   reportRoutes);
app.use('/api/search',    searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/tasks/:taskId/comments', commentsRouter);
app.use('/api/sprints', sprintAnalyticsRouter);
app.use('/api/tasks/:taskId/time-logs', timeLogsRouter);
app.use('/api/time-logs', timeReportRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`🚀 AgileFlow API running on port ${PORT}`);
});

export default app;
