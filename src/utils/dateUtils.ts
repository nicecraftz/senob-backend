export type TimeFrame = '1d' | '1w' | '1m' | '6m' | '1y';

export interface DateRange {
    start: Date;
    end: Date;
    previousStart?: Date;
    previousEnd?: Date;
}

export type GroupingInterval = 'hour' | 'day' | 'week' | 'month';

type DateUnit = 'day' | 'month' | 'year';

interface TimeFrameConfig {
    duration: number;
    unit: DateUnit;
    groupingInterval: GroupingInterval;
    includeToday: boolean;
}

/**
 * Configuration for each time frame
 */
const TIME_FRAME_CONFIG: Record<TimeFrame, TimeFrameConfig> = {
    '1d': {
        duration: 1,
        unit: 'day',
        groupingInterval: 'hour',
        includeToday: true
    },
    '1w': {
        duration: 7,
        unit: 'day',
        groupingInterval: 'day',
        includeToday: true
    },
    '1m': {
        duration: 1,
        unit: 'month',
        groupingInterval: 'day',
        includeToday: true
    },
    '6m': {
        duration: 6,
        unit: 'month',
        groupingInterval: 'week',
        includeToday: true
    },
    '1y': {
        duration: 1,
        unit: 'year',
        groupingInterval: 'month',
        includeToday: true
    }
};

/**
 * Add or subtract time units from a date
 */
function addTimeUnit(date: Date, amount: number, unit: DateUnit): Date {
    const result = new Date(date);
    
    switch (unit) {
        case 'day':
            result.setDate(result.getDate() + amount);
            break;
        case 'month':
            result.setMonth(result.getMonth() + amount);
            break;
        case 'year':
            result.setFullYear(result.getFullYear() + amount);
            break;
    }
    
    return result;
}

/**
 * Set time to start of day (00:00:00.000)
 */
function setStartOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

/**
 * Set time to end of day (23:59:59.999)
 */
function setEndOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}

/**
 * Calculate the start date for a time frame
 */
function calculateStartDate(now: Date, config: TimeFrameConfig): Date {
    // For day-based time frames, we want to include today, so we subtract (duration - 1)
    // For month/year-based, we subtract the full duration
    if (config.unit === 'day') {
        const daysToSubtract = config.includeToday ? config.duration - 1 : config.duration;
        const start = addTimeUnit(now, -daysToSubtract, config.unit);
        return setStartOfDay(start);
    }
    
    const start = addTimeUnit(now, -config.duration, config.unit);
    return setStartOfDay(start);
}

/**
 * Calculate the end date for a time frame
 */
function calculateEndDate(now: Date, config: TimeFrameConfig): Date {
    return config.includeToday ? setEndOfDay(now) : setEndOfDay(addTimeUnit(now, -1, 'day'));
}

/**
 * Calculate the previous period dates
 */
function calculatePreviousPeriod(
    start: Date,
    end: Date,
    config: TimeFrameConfig
): { previousStart: Date; previousEnd: Date } {
    const periodDuration = end.getTime() - start.getTime();
    const previousEnd = new Date(start);
    previousEnd.setTime(previousEnd.getTime() - 1);
    const previousStart = new Date(previousEnd);
    previousStart.setTime(previousStart.getTime() - periodDuration);
    
    return {
        previousStart: setStartOfDay(previousStart),
        previousEnd: setEndOfDay(previousEnd)
    };
}

/**
 * Calculate date ranges based on time frame
 */
export function getDateRange(timeFrame: TimeFrame): DateRange {
    const config = TIME_FRAME_CONFIG[timeFrame];
    if (!config) {
        throw new Error(`Invalid time frame: ${timeFrame}`);
    }

    const now = new Date();
    const start = calculateStartDate(now, config);
    const end = calculateEndDate(now, config);
    const { previousStart, previousEnd } = calculatePreviousPeriod(start, end, config);

    return { start, end, previousStart, previousEnd };
}

/**
 * Get grouping interval based on time frame
 */
export function getGroupingInterval(timeFrame: TimeFrame): GroupingInterval {
    const config = TIME_FRAME_CONFIG[timeFrame];
    if (!config) {
        throw new Error(`Invalid time frame: ${timeFrame}`);
    }
    return config.groupingInterval;
}

/**
 * Format date components for consistent formatting
 */
interface DateComponents {
    year: string;
    month: string;
    day: string;
    hour: string;
}

function getDateComponents(date: Date): DateComponents {
    return {
        year: String(date.getFullYear()),
        month: String(date.getMonth() + 1).padStart(2, '0'),
        day: String(date.getDate()).padStart(2, '0'),
        hour: String(date.getHours()).padStart(2, '0')
    };
}

/**
 * Get the start of the week (Monday) for a given date
 */
function getWeekStart(date: Date): Date {
    const weekStart = new Date(date);
    const dayOfWeek = weekStart.getDay() || 7; // Convert Sunday (0) to 7
    weekStart.setDate(weekStart.getDate() - dayOfWeek + 1); // Move to Monday
    return weekStart;
}

/**
 * Format date for grouping based on interval
 */
export function formatDateForGrouping(date: Date, interval: GroupingInterval): string {
    const components = getDateComponents(date);

    switch (interval) {
        case 'hour':
            return `${components.year}-${components.month}-${components.day} ${components.hour}:00`;
        case 'day':
            return `${components.year}-${components.month}-${components.day}`;
        case 'week': {
            const weekStart = getWeekStart(date);
            const weekComponents = getDateComponents(weekStart);
            return `${weekComponents.year}-${weekComponents.month}-${weekComponents.day}`;
        }
        case 'month':
            return `${components.year}-${components.month}`;
    }
}

/**
 * Normalize a date value (handles both Date objects and strings)
 */
export function normalizeDate(date: Date | string | undefined): Date | null {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === 'string') {
        const parsed = new Date(date);
        if (isNaN(parsed.getTime())) return null;
        
        // Handle date-only strings (YYYY-MM-DD)
        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            return setStartOfDay(parsed);
        }
        return parsed;
    }
    return null;
}

/**
 * Check if a date is within a range (inclusive)
 */
export function isDateInRange(date: Date, start: Date, end: Date): boolean {
    const normalizedDate = setStartOfDay(new Date(date));
    const normalizedStart = setStartOfDay(new Date(start));
    const normalizedEnd = setEndOfDay(new Date(end));
    
    return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
}
