import { Hono } from 'hono';
import { appointmentsCollection } from '../database';
import { Appointment } from '../models';
import { createApiResponse } from '../types/api';
import { ObjectId } from 'mongodb';
import { HTTPError } from '../utils/errors';

const appointmentRoutes = new Hono();

// GET /appointments - Get all appointments
appointmentRoutes.get('/', async (c) => {
    if (!appointmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const patientId = c.req.query('patientId');
    const date = c.req.query('date');
    const startDate = c.req.query('startDate');
    const endDate = c.req.query('endDate');

    const query: any = {};
    if (patientId) query.patientId = Number(patientId);
    if (date) {
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate && endDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date = { $gte: start, $lte: end };
    }

    const appointments = await appointmentsCollection.find(query).sort({ date: 1 }).toArray();
    return c.json(createApiResponse(appointments));
});

// GET /appointments/:id - Get appointment by ID
appointmentRoutes.get('/:id', async (c) => {
    if (!appointmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const id = c.req.param('id');
    const appointment = await appointmentsCollection.findOne(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    if (!appointment) {
        throw new HTTPError('Appointment not found', 404, 'Not Found');
    }

    return c.json(createApiResponse(appointment));
});

// POST /appointments - Create a new appointment
appointmentRoutes.post('/', async (c) => {
    if (!appointmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const body = await c.req.json();
    const {
        id,
        patientId,
        date
    } = body;

    // Validation
    if (id === undefined || patientId === undefined || !date) {
        throw new HTTPError('Missing required fields', 400, 'Validation Error');
    }

    // Check if id already exists
    const existingAppointment = await appointmentsCollection.findOne({ id: Number(id) });
    if (existingAppointment) {
        throw new HTTPError('Appointment ID already exists', 409, 'Conflict');
    }

    const now = new Date();
    const newAppointment: Appointment = {
        id: Number(id),
        patientId: Number(patientId),
        date: new Date(date),
        createdAt: now,
        updatedAt: now
    };

    const result = await appointmentsCollection.insertOne(newAppointment);
    const createdAppointment = await appointmentsCollection.findOne({ _id: result.insertedId });

    return c.json(createApiResponse(createdAppointment, {
        message: 'Appointment created successfully',
        description: 'A new appointment has been scheduled',
        context: 'appointment-creation'
    }), 201);
});

// PUT /appointments/:id - Update an appointment
appointmentRoutes.put('/:id', async (c) => {
    if (!appointmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const id = c.req.param('id');
    const body = await c.req.json();

    const { patientId, date } = body;

    const updateData: Partial<Appointment> = {
        updatedAt: new Date()
    };

    if (patientId !== undefined) updateData.patientId = Number(patientId);
    if (date !== undefined) updateData.date = new Date(date);

    const result = await appointmentsCollection.findOneAndUpdate(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any,
        { $set: updateData },
        { returnDocument: 'after' }
    );

    if (!result) {
        throw new HTTPError('Appointment not found', 404, 'Not Found');
    }

    return c.json(createApiResponse(result, {
        message: 'Appointment updated successfully',
        description: 'Appointment information has been updated',
        context: 'appointment-update'
    }));
});

// DELETE /appointments/:id - Delete an appointment
appointmentRoutes.delete('/:id', async (c) => {
    if (!appointmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const id = c.req.param('id');
    const result = await appointmentsCollection.findOneAndDelete(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    if (!result) {
        throw new HTTPError('Appointment not found', 404, 'Not Found');
    }

    return c.json(createApiResponse(null, {
        message: 'Appointment deleted successfully',
        description: 'Appointment has been removed from the system',
        context: 'appointment-deletion'
    }));
});

export default appointmentRoutes;

