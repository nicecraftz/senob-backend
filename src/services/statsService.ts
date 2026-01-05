import { patientsCollection, treatmentsCollection } from '../database';
import { HTTPError } from '../utils/errors';
import { TimeFrame, getDateRange, getGroupingInterval, formatDateForGrouping, normalizeDate, isDateInRange } from '../utils/dateUtils';
import { TimeSeriesStats, OverviewStats } from '../types/stats';

/**
 * Service for statistics-related business logic
 */
export class StatsService {
    /**
     * Get new patients statistics
     */
    static async getPatientsStats(timeFrame: TimeFrame = '1m'): Promise<TimeSeriesStats> {
        if (!patientsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

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

        // Group data by interval
        const currentGrouped = this.groupByInterval(currentPatients, interval, (p) => p.createdAt);
        const previousGrouped = this.groupByInterval(previousPatients, interval, (p) => p.createdAt);

        const totalCurrent = currentPatients.length;
        const totalPrevious = previousPatients.length;
        const change = totalPrevious > 0 
            ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 
            : totalCurrent > 0 ? 100 : 0;

        return {
            timeFrame,
            current: {
                data: this.convertToPeriodData(currentGrouped),
                total: totalCurrent
            },
            previous: {
                data: this.convertToPeriodData(previousGrouped),
                total: totalPrevious
            },
            change: Math.round(change * 100) / 100
        };
    }

    /**
     * Get treatments statistics
     */
    static async getTreatmentsStats(timeFrame: TimeFrame = '1m'): Promise<TimeSeriesStats> {
        if (!treatmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const { start, end, previousStart, previousEnd } = getDateRange(timeFrame);
        const interval = getGroupingInterval(timeFrame);

        // Retrieve all treatments and filter in code to handle both Date objects and strings
        const allTreatments = await treatmentsCollection.find({}).toArray();
        
        // Filter treatments by date range
        const currentTreatments = allTreatments.filter(treatment => {
            const date = normalizeDate(treatment.date);
            return date && isDateInRange(date, start, end);
        });

        // Previous period data
        let previousTreatments: any[] = [];
        if (previousStart && previousEnd) {
            previousTreatments = allTreatments.filter(treatment => {
                const date = normalizeDate(treatment.date);
                return date && isDateInRange(date, previousStart, previousEnd);
            });
        }

        // Group data by interval
        const currentGrouped = this.groupByInterval(currentTreatments, interval, (t) => t.date);
        const previousGrouped = this.groupByInterval(previousTreatments, interval, (t) => t.date);

        const totalCurrent = currentTreatments.length;
        const totalPrevious = previousTreatments.length;
        const change = totalPrevious > 0 
            ? ((totalCurrent - totalPrevious) / totalPrevious) * 100 
            : totalCurrent > 0 ? 100 : 0;

        return {
            timeFrame,
            current: {
                data: this.convertToPeriodData(currentGrouped),
                total: totalCurrent
            },
            previous: {
                data: this.convertToPeriodData(previousGrouped),
                total: totalPrevious
            },
            change: Math.round(change * 100) / 100
        };
    }

    /**
     * Get overview statistics
     */
    static async getOverviewStats(timeFrame: TimeFrame = '1m'): Promise<OverviewStats> {
        if (!patientsCollection || !treatmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

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
            const date = normalizeDate(treatment.date);
            return date && isDateInRange(date, start, end);
        }).length;

        // Previous period
        let previousPatients = 0;
        let previousTreatments = 0;
        if (previousStart && previousEnd) {
            previousPatients = await patientsCollection.countDocuments({
                createdAt: { $gte: previousStart, $lte: previousEnd }
            });
            
            previousTreatments = allTreatmentsForOverview.filter(treatment => {
                const date = normalizeDate(treatment.date);
                return date && isDateInRange(date, previousStart, previousEnd);
            }).length;
        }

        const patientsChange = previousPatients > 0 
            ? ((currentPatients - previousPatients) / previousPatients) * 100 
            : currentPatients > 0 ? 100 : 0;

        const treatmentsChange = previousTreatments > 0 
            ? ((currentTreatmentsCount - previousTreatments) / previousTreatments) * 100 
            : currentTreatmentsCount > 0 ? 100 : 0;

        return {
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
        };
    }

    /**
     * Group items by interval based on a date field
     */
    private static groupByInterval(
        items: any[],
        interval: ReturnType<typeof getGroupingInterval>,
        dateExtractor: (item: any) => Date | string | undefined
    ): Record<string, number> {
        const grouped: Record<string, number> = {};
        
        items.forEach(item => {
            const dateValue = dateExtractor(item);
            const date = normalizeDate(dateValue);
            
            if (date) {
                const key = formatDateForGrouping(date, interval);
                grouped[key] = (grouped[key] || 0) + 1;
            }
        });
        
        return grouped;
    }

    /**
     * Convert grouped data to period data array
     */
    private static convertToPeriodData(grouped: Record<string, number>): Array<{ period: string; count: number }> {
        return Object.entries(grouped)
            .map(([period, count]) => ({ period, count }))
            .sort((a, b) => a.period.localeCompare(b.period));
    }
}

