import { Hono } from 'hono';
import { StatsService } from '../services/statsService';
import { createApiResponse } from '../types/api';
import { TimeFrame } from '../utils/dateUtils';

const statsRoutes = new Hono();

/**
 * GET /stats/patients - Get new patients statistics
 */
statsRoutes.get('/patients', async (c) => {
    const timeFrame = (c.req.query('timeFrame') || '1m') as TimeFrame;
    const stats = await StatsService.getPatientsStats(timeFrame);
    return c.json(createApiResponse(stats));
});

/**
 * GET /stats/treatments - Get treatments statistics
 */
statsRoutes.get('/treatments', async (c) => {
    const timeFrame = (c.req.query('timeFrame') || '1m') as TimeFrame;
    const stats = await StatsService.getTreatmentsStats(timeFrame);
    return c.json(createApiResponse(stats));
});

/**
 * GET /stats/overview - Get overview statistics
 */
statsRoutes.get('/overview', async (c) => {
    const timeFrame = (c.req.query('timeFrame') || '1m') as TimeFrame;
    const stats = await StatsService.getOverviewStats(timeFrame);
    return c.json(createApiResponse(stats));
});

export default statsRoutes;
