import { appointmentsCollection } from '../database';
import { Appointment } from '../models';
import { HTTPError } from '../utils/errors';
import { buildObjectIdQuery, buildDateRangeQuery } from '../utils/queryBuilder';
import { validateRequiredFields } from '../utils/validation';
import { CreateAppointmentRequest, UpdateAppointmentRequest, AppointmentQueryParams } from '../types/appointment';

/**
 * Service for appointment-related business logic
 */
export class AppointmentService {
    /**
     * Get all appointments with optional filters
     */
    static async getAllAppointments(params: AppointmentQueryParams): Promise<Appointment[]> {
        if (!appointmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const query: any = {};
        
        if (params.patientId) {
            query.patientId = Number(params.patientId);
        }
        
        if (params.date) {
            const dateRangeQuery = buildDateRangeQuery(params.date, params.date, 'date');
            Object.assign(query, dateRangeQuery);
        } else if (params.startDate && params.endDate) {
            const dateRangeQuery = buildDateRangeQuery(params.startDate, params.endDate, 'date');
            Object.assign(query, dateRangeQuery);
        }

        return await appointmentsCollection.find(query).sort({ date: 1 }).toArray();
    }

    /**
     * Get appointment by ID
     */
    static async getAppointmentById(id: string): Promise<Appointment> {
        if (!appointmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const appointment = await appointmentsCollection.findOne(buildObjectIdQuery(id) as any);

        if (!appointment) {
            throw new HTTPError('Appointment not found', 404, 'Not Found');
        }

        return appointment;
    }

    /**
     * Create a new appointment
     */
    static async createAppointment(data: CreateAppointmentRequest): Promise<Appointment> {
        if (!appointmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        validateRequiredFields(data, ['patientId', 'date']);

        const now = new Date();
        const newAppointment: Omit<Appointment, '_id'> = {
            patientId: Number(data.patientId),
            date: new Date(data.date),
            createdAt: now,
            updatedAt: now
        };

        const result = await appointmentsCollection.insertOne(newAppointment);
        const createdAppointment = await appointmentsCollection.findOne({ _id: result.insertedId });

        if (!createdAppointment) {
            throw new HTTPError('Failed to create appointment', 500, 'Server Error');
        }

        return createdAppointment;
    }

    /**
     * Update an appointment
     */
    static async updateAppointment(id: string, data: UpdateAppointmentRequest): Promise<Appointment> {
        if (!appointmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const updateData: Partial<Appointment> = {
            updatedAt: new Date()
        };

        if (data.patientId !== undefined) updateData.patientId = Number(data.patientId);
        if (data.date !== undefined) updateData.date = new Date(data.date);

        const result = await appointmentsCollection.findOneAndUpdate(
            buildObjectIdQuery(id) as any,
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new HTTPError('Appointment not found', 404, 'Not Found');
        }

        return result;
    }

    /**
     * Delete an appointment
     */
    static async deleteAppointment(id: string): Promise<void> {
        if (!appointmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const result = await appointmentsCollection.findOneAndDelete(buildObjectIdQuery(id) as any);

        if (!result) {
            throw new HTTPError('Appointment not found', 404, 'Not Found');
        }
    }
}

