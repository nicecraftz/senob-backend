import { ObjectId } from 'mongodb';

/**
 * Build a MongoDB query filter for finding documents by ID
 * Supports both MongoDB ObjectId and numeric ID (for backward compatibility with existing data)
 */
export function buildIdQuery(id: string): { $or: [{ _id: ObjectId }, { id: number }] } | { id: number } {
    if (ObjectId.isValid(id)) {
        return { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] };
    }
    return { id: Number(id) };
}

/**
 * Build a MongoDB query filter using only _id (for appointments)
 */
export function buildObjectIdQuery(id: string): { _id: ObjectId } {
    if (!ObjectId.isValid(id)) {
        throw new Error(`Invalid ObjectId: ${id}`);
    }
    return { _id: new ObjectId(id) };
}

/**
 * Build a date range query for MongoDB
 */
export function buildDateRangeQuery(startDate?: string, endDate?: string, dateField: string = 'date') {
    const query: any = {};
    
    if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query[dateField] = { $gte: start, $lte: end };
    } else if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(startDate);
        end.setHours(23, 59, 59, 999);
        query[dateField] = { $gte: start, $lte: end };
    }
    
    return query;
}

