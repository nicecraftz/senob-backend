import { HTTPError } from './errors';

/**
 * Validate required fields in an object
 */
export function validateRequiredFields(data: Record<string, any>, requiredFields: string[]): void {
    const missingFields = requiredFields.filter(field => {
        const value = data[field];
        // Check for undefined, null, or empty string (but allow 0, false, and Date objects)
        return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
    });

    if (missingFields.length > 0) {
        throw new HTTPError(
            `Missing required fields: ${missingFields.join(', ')}`,
            400,
            'Validation Error'
        );
    }
}

/**
 * Validate content type
 */
export function validateContentType(contentType: string | null, expectedType: string): void {
    if (!contentType || !contentType.includes(expectedType)) {
        throw new HTTPError(
            `Content-Type must be ${expectedType}`,
            400,
            'Validation Error'
        );
    }
}

