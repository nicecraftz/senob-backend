import { TimeFrame } from '../utils/dateUtils';

export interface StatsQueryParams {
    timeFrame?: TimeFrame;
}

export interface PeriodData {
    period: string;
    count: number;
}

export interface TimeSeriesStats {
    timeFrame: TimeFrame;
    current: {
        data: PeriodData[];
        total: number;
    };
    previous: {
        data: PeriodData[];
        total: number;
    };
    change: number;
}

export interface OverviewStats {
    timeFrame: TimeFrame;
    patients: {
        current: number;
        previous: number;
        change: number;
    };
    treatments: {
        current: number;
        previous: number;
        change: number;
    };
}

