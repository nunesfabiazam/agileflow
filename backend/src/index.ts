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

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const allowed = (process.env.FRONTEND_URL || 'http://localhost:5173').split(',').map(s => s.trim());
    if (allowed.some(u => origin.startsWith(u)) || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    callback(null, allowed[0]);
  },
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`🚀 AgileFlow API running on http://localhost:${PORT}`);
});

export default app;
