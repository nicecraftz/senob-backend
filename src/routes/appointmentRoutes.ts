import { Hono } from 'hono';
import { AppointmentService } from '../services/appointmentService';
import { createApiResponse } from '../types/api';
import { AppointmentQueryParams } from '../types/appointment';

const appointmentRoutes = new Hono();

// GET /appointments - Get all appointments
appointmentRoutes.get('/', async (c) => {
    const params: AppointmentQueryParams = {
        patientId: c.req.query('patientId'),
        date: c.req.query('date'),
        startDate: c.req.query('startDate'),
        endDate: c.req.query('endDate')
    };

    const appointments = await AppointmentService.getAllAppointments(params);
    return c.json(createApiResponse(appointments));
});

// GET /appointments/:id - Get appointment by ID
appointmentRoutes.get('/:id', async (c) => {
    const id = c.req.param('id');
    const appointment = await AppointmentService.getAppointmentById(id);
    return c.json(createApiResponse(appointment));
});

// POST /appointments - Create a new appointment
appointmentRoutes.post('/', async (c) => {
    const body = await c.req.json();
    const appointment = await AppointmentService.createAppointment(body);
    
    return c.json(createApiResponse(appointment, {
        message: 'Appointment created successfully',
        description: 'A new appointment has been scheduled',
        context: 'appointment-creation'
    }), 201);
});

// PUT /appointments/:id - Update an appointment
appointmentRoutes.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const appointment = await AppointmentService.updateAppointment(id, body);
    
    return c.json(createApiResponse(appointment, {
        message: 'Appointment updated successfully',
        description: 'Appointment information has been updated',
        context: 'appointment-update'
    }));
});

// DELETE /appointments/:id - Delete an appointment
appointmentRoutes.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await AppointmentService.deleteAppointment(id);
    
    return c.json(createApiResponse(null, {
        message: 'Appointment deleted successfully',
        description: 'Appointment has been removed from the system',
        context: 'appointment-deletion'
    }));
});

export default appointmentRoutes;
