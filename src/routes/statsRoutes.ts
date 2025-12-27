import { Hono } from 'hono';
import { patientsCollection, treatmentsCollection } from '../database';
import { createApiResponse } from '../types/api';
import { HTTPError } from '../utils/errors';

const statsRoutes = new Hono();

export type TimeFrame = '1d' | '1w' | '1m' | '6m' | '1y';

interface DateRange {
    start: Date;
    end: Date;
    previousStart?: Date;
    previousEnd?: Date;
}

/**
 * Calculate date ranges based on time frame
 */
function getDateRange(timeFrame: TimeFrame): DateRange {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    let start: Date;
    let previousStart: Date | undefined;
    let previousEnd: Date | undefined;

    switch (timeFrame) {
        case '1d':
            start = new Date(now);
            start.setHours(0, 0, 0, 0);
            // Previous day
            previousStart = new Date(start);
            previousStart.setDate(previousStart.getDate() - 1);
            previousEnd = new Date(end);
            previousEnd.setDate(previousEnd.getDate() - 1);
            break;
        case '1w':
            start = new Date(now);
            start.setDate(start.getDate() - 6); // Last 7 days including today
            start.setHours(0, 0, 0, 0);
            // Previous week
            previousStart = new Date(start);
            previousStart.setDate(previousStart.getDate() - 7);
            previousEnd = new Date(start);
            previousEnd.setDate(previousEnd.getDate() - 1);
            previousEnd.setHours(23, 59, 59, 999);
            break;
        case '1m':
            start = new Date(now);
            start.setMonth(start.getMonth() - 1);
            start.setHours(0, 0, 0, 0);
            // Previous month
            previousStart = new Date(start);
            previousStart.setMonth(previousStart.getMonth() - 1);
            previousEnd = new Date(start);
            previousEnd.setDate(previousEnd.getDate() - 1);
            previousEnd.setHours(23, 59, 59, 999);
            break;
        case '6m':
            start = new Date(now);
            start.setMonth(start.getMonth() - 6);
            start.setHours(0, 0, 0, 0);
            // Previous 6 months
            previousStart = new Date(start);
            previousStart.setMonth(previousStart.getMonth() - 6);
            previousEnd = new Date(start);
            previousEnd.setDate(previousEnd.getDate() - 1);
            previousEnd.setHours(23, 59, 59, 999);
            break;
        case '1y':
            start = new Date(now);
            start.setFullYear(start.getFullYear() - 1);
            start.setHours(0, 0, 0, 0);
            // Previous year
            previousStart = new Date(start);
            previousStart.setFullYear(previousStart.getFullYear() - 1);
            previousEnd = new Date(start);
            previousEnd.setDate(previousEnd.getDate() - 1);
            previousEnd.setHours(23, 59, 59, 999);
            break;
    }

    return { start, end, previousStart, previousEnd };
}

/**
 * Get grouping interval based on time frame
 */
function getGroupingInterval(timeFrame: TimeFrame): 'hour' | 'day' | 'week' | 'month' {
    switch (timeFrame) {
        case '1d':
            return 'hour';
        case '1w':
            return 'day';
        case '1m':
            return 'day';
        case '6m':
            return 'week';
        case '1y':
            return 'month';
    }
}

/**
 * Format date for grouping based on interval
 */
function formatDateForGrouping(date: Date, interval: 'hour' | 'day' | 'week' | 'month'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');

    switch (interval) {
        case 'hour':
            return `${year}-${month}-${day} ${hour}:00`;
        case 'day':
            return `${year}-${month}-${day}`;
        case 'week':
            // Get ISO week
            const weekDate = new Date(date);
            const dayOfWeek = weekDate.getDay() || 7; // Convert Sunday (0) to 7
            weekDate.setDate(weekDate.getDate() - dayOfWeek + 1); // Monday of the week
            const weekYear = weekDate.getFullYear();
            const weekMonth = String(weekDate.getMonth() + 1).padStart(2, '0');
            const weekDay = String(weekDate.getDate()).padStart(2, '0');
            return `${weekYear}-${weekMonth}-${weekDay}`;
        case 'month':
            return `${year}-${month}`;
    }
}

/**
 * GET /stats/patients - Get new patients statistics
 */
statsRoutes.get('/patients', async (c) => {
    if (!patientsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const timeFrame = (c.req.query('timeFrame') || '1m') as TimeFrame;
    const { start, end, previousStart, previousEnd } = getDateRange(timeFrame);
    const interval = getGroupingInterval(timeFrame);

    // Current period data
    const currentPatients = await patientsCollection.find({
        createdAt: {
            $gte: start,
            $lte: end
        }
    }).toArray();

    // Previous period data for comparison
    let previousPatients: any[] = [];
    if (previousStart && previousEnd) {
        previousPatients = await patientsCollection.find({
            createdAt: {
                $gte: previousStart,
                $lte: previousEnd
            }
        }).toArray();
    }

    // Group current data by interval
    const currentGrouped: Record<string, number> = {};
    currentPatients.forEach(patient => {
        const date = patient.createdAt ? new Date(patient.createdAt) : new Date();
        const key = formatDateForGrouping(date, interval);
        currentGrouped[key] = (currentGrouped[key] || 0) + 1;
    });

    // Group previous data by interval
    const previousGrouped: Record<string, number> = {};
    previousPatients.forEach(patient => {
        const date = patient.createdAt ? new Date(patient.createdAt) : new Date();
        const key = formatDateForGrouping(date, interval);
        previousGrouped[key] = (previousGrouped[key] || 0) + 1;
    });

    // Convert to array format
    const currentData = Object.entries(currentGrouped)
        .map(([period, count]) => ({ period, count }))
        .sort((a, b) => a.period.localeCompare(b.period));

    const previousData = Object.entries(previousGrouped)
        .map(([period, count]) => ({ period, count }))
        .sort((a, b) => a.period.localeCompare(b.period));

    const totalCurrent = currentPatients.length;
    const totalPrevious = previousPatients.length;
    const change = totalPrevious > 0 
        ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 
        : totalCurrent > 0 ? 100 : 0;

    return c.json(createApiResponse({
        timeFrame,
        current: {
            data: currentData,
            total: totalCurrent
        },
        previous: {
            data: previousData,
            total: totalPrevious
        },
        change: Math.round(change * 100) / 100
    }));
});

/**
 * GET /stats/treatments - Get treatments statistics
 */
statsRoutes.get('/treatments', async (c) => {
    if (!treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const timeFrame = (c.req.query('timeFrame') || '1m') as TimeFrame;
    const { start, end, previousStart, previousEnd } = getDateRange(timeFrame);
    const interval = getGroupingInterval(timeFrame);

    // Current period data - Retrieve all treatments and filter in code to handle both Date objects and strings
    // This is more reliable than MongoDB queries with mixed types
    const allTreatments = await treatmentsCollection.find({}).toArray();
    
    // Filter treatments by date range, handling both Date objects and string dates
    const currentTreatments = allTreatments.filter(treatment => {
        let date: Date;
        if (treatment.date instanceof Date) {
            date = treatment.date;
        } else if (typeof treatment.date === 'string') {
            date = new Date(treatment.date);
        } else {
            return false;
        }
        
        // Normalize to start of day for comparison
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);
        const normalizedStart = new Date(start);
        normalizedStart.setHours(0, 0, 0, 0);
        const normalizedEnd = new Date(end);
        normalizedEnd.setHours(23, 59, 59, 999);
        
        return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
    });

    // Previous period data for comparison - filter from all treatments
    let previousTreatments: any[] = [];
    if (previousStart && previousEnd) {
        previousTreatments = allTreatments.filter(treatment => {
            let date: Date;
            if (treatment.date instanceof Date) {
                date = treatment.date;
            } else if (typeof treatment.date === 'string') {
                date = new Date(treatment.date);
            } else {
                return false;
            }
            
            // Normalize to start of day for comparison
            const normalizedDate = new Date(date);
            normalizedDate.setHours(0, 0, 0, 0);
            const normalizedPreviousStart = new Date(previousStart);
            normalizedPreviousStart.setHours(0, 0, 0, 0);
            const normalizedPreviousEnd = new Date(previousEnd);
            normalizedPreviousEnd.setHours(23, 59, 59, 999);
            
            return normalizedDate >= normalizedPreviousStart && normalizedDate <= normalizedPreviousEnd;
        });
    }

    // Group current data by interval
    const currentGrouped: Record<string, number> = {};
    currentTreatments.forEach(treatment => {
        let date: Date;
        if (treatment.date instanceof Date) {
            date = treatment.date;
        } else if (typeof treatment.date === 'string') {
            date = new Date(treatment.date);
            // Handle date-only strings (YYYY-MM-DD) by setting time to start of day
            if (treatment.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                date.setHours(0, 0, 0, 0);
            }
        } else {
            date = new Date();
        }
        // Normalize date to start of day for comparison
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);
        const normalizedStart = new Date(start);
        normalizedStart.setHours(0, 0, 0, 0);
        const normalizedEnd = new Date(end);
        normalizedEnd.setHours(23, 59, 59, 999);
        
        // Only include if date is within range
        if (normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd) {
            const key = formatDateForGrouping(date, interval);
            currentGrouped[key] = (currentGrouped[key] || 0) + 1;
        }
    });

    // Group previous data by interval
    const previousGrouped: Record<string, number> = {};
    previousTreatments.forEach(treatment => {
        let date: Date;
        if (treatment.date instanceof Date) {
            date = treatment.date;
        } else if (typeof treatment.date === 'string') {
            date = new Date(treatment.date);
            // Handle date-only strings (YYYY-MM-DD) by setting time to start of day
            if (treatment.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                date.setHours(0, 0, 0, 0);
            }
        } else {
            date = new Date();
        }
        // Normalize date to start of day for comparison
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);
        
        // Only include if date is within previous range
        if (previousStart && previousEnd) {
            const normalizedPreviousStart = new Date(previousStart);
            normalizedPreviousStart.setHours(0, 0, 0, 0);
            const normalizedPreviousEnd = new Date(previousEnd);
            normalizedPreviousEnd.setHours(23, 59, 59, 999);
            
            if (normalizedDate >= normalizedPreviousStart && normalizedDate <= normalizedPreviousEnd) {
                const key = formatDateForGrouping(date, interval);
                previousGrouped[key] = (previousGrouped[key] || 0) + 1;
            }
        }
    });

    // Convert to array format
    const currentData = Object.entries(currentGrouped)
        .map(([period, count]) => ({ period, count }))
        .sort((a, b) => a.period.localeCompare(b.period));

    const previousData = Object.entries(previousGrouped)
        .map(([period, count]) => ({ period, count }))
        .sort((a, b) => a.period.localeCompare(b.period));

    const totalCurrent = currentTreatments.length;
    const totalPrevious = previousTreatments.length;
    const change = totalPrevious > 0 
        ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 
        : totalCurrent > 0 ? 100 : 0;

    return c.json(createApiResponse({
        timeFrame,
        current: {
            data: currentData,
            total: totalCurrent
        },
        previous: {
            data: previousData,
            total: totalPrevious
        },
        change: Math.round(change * 100) / 100
    }));
});

/**
 * GET /stats/overview - Get overview statistics
 */
statsRoutes.get('/overview', async (c) => {
    if (!patientsCollection || !treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const timeFrame = (c.req.query('timeFrame') || '1m') as TimeFrame;
    const { start, end, previousStart, previousEnd } = getDateRange(timeFrame);

    // Current period - for treatments, we need to filter manually to handle both Date and string formats
    const [currentPatients, allTreatmentsForOverview] = await Promise.all([
        patientsCollection.countDocuments({
            createdAt: { $gte: start, $lte: end }
        }),
        treatmentsCollection.find({}).toArray()
    ]);
    
    // Filter treatments by date range
    const currentTreatmentsCount = allTreatmentsForOverview.filter(treatment => {
        let date: Date;
        if (treatment.date instanceof Date) {
            date = treatment.date;
        } else if (typeof treatment.date === 'string') {
            date = new Date(treatment.date);
        } else {
            return false;
        }
        
        // Normalize to start of day for comparison
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);
        const normalizedStart = new Date(start);
        normalizedStart.setHours(0, 0, 0, 0);
        const normalizedEnd = new Date(end);
        normalizedEnd.setHours(23, 59, 59, 999);
        
        return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
    }).length;

    // Previous period
    let previousPatients = 0;
    let previousTreatments = 0;
    if (previousStart && previousEnd) {
        previousPatients = await patientsCollection.countDocuments({
            createdAt: { $gte: previousStart, $lte: previousEnd }
        });
        
        // Filter treatments from already retrieved list
        previousTreatments = allTreatmentsForOverview.filter(treatment => {
            let date: Date;
            if (treatment.date instanceof Date) {
                date = treatment.date;
            } else if (typeof treatment.date === 'string') {
                date = new Date(treatment.date);
            } else {
                return false;
            }
            
            // Normalize to start of day for comparison
            const normalizedDate = new Date(date);
            normalizedDate.setHours(0, 0, 0, 0);
            const normalizedPreviousStart = new Date(previousStart);
            normalizedPreviousStart.setHours(0, 0, 0, 0);
            const normalizedPreviousEnd = new Date(previousEnd);
            normalizedPreviousEnd.setHours(23, 59, 59, 999);
            
            return normalizedDate >= normalizedPreviousStart && normalizedDate <= normalizedPreviousEnd;
        }).length;
    }

    const patientsChange = previousPatients > 0 
        ? ((currentPatients - previousPatients) / previousPatients) * 100 
        : currentPatients > 0 ? 100 : 0;

    const treatmentsChange = previousTreatments > 0 
        ? ((currentTreatmentsCount - previousTreatments) / previousTreatments) * 100 
        : currentTreatmentsCount > 0 ? 100 : 0;

    return c.json(createApiResponse({
        timeFrame,
        patients: {
            current: currentPatients,
            previous: previousPatients,
            change: Math.round(patientsChange * 100) / 100
        },
        treatments: {
            current: currentTreatmentsCount,
            previous: previousTreatments,
            change: Math.round(treatmentsChange * 100) / 100
        }
    }));
});

export default statsRoutes;

