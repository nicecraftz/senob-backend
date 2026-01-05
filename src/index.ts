import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { connectDatabase, closeDatabase } from './database';
import patientRoutes from './routes/patientRoutes';
import treatmentRoutes from './routes/treatmentRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import statsRoutes from './routes/statsRoutes';
import aiRoutes from './routes/aiRoutes';
import { HTTPError } from './utils/errors';
import { createApiError } from './types/api';

const app = new Hono();

// Error handler
app.onError((err, c) => {
    console.error('Error:', err);
    
    if (err instanceof HTTPError) {
        return c.json(createApiError(err.errorCode, err.message), err.statusCode as any);
    }
  
    return c.json(createApiError('Server Error', err.message || 'An unexpected error occurred'), 500);
});

// CORS middleware
app.use('/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Origin'],
}));

// Health check endpoint
app.get('/health', (c) => {
    return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.route('/api/patients', patientRoutes);
app.route('/api/treatments', treatmentRoutes);
app.route('/api/appointments', appointmentRoutes);
app.route('/api/stats', statsRoutes);
app.route('/api/ai', aiRoutes);

// Connect to database on startup
connectDatabase().catch((error) => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await closeDatabase();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down gracefully...');
    await closeDatabase();
    process.exit(0);
});

export default app;