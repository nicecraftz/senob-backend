import { Hono } from 'hono';
import { PatientService } from '../services/patientService';
import { createApiResponse } from '../types/api';
import { validateRequiredFields } from '../utils/validation';

const patientRoutes = new Hono();

// GET /patients - Get all patients
patientRoutes.get('/', async (c) => {
    const patients = await PatientService.getAllPatients();
    return c.json(createApiResponse(patients));
});

// GET /patients/:id - Get patient by ID
patientRoutes.get('/:id', async (c) => {
    const id = c.req.param('id');
    const patient = await PatientService.getPatientById(id);
    return c.json(createApiResponse(patient));
});

// POST /patients - Create a new patient
patientRoutes.post('/', async (c) => {
    const body = await c.req.json();
    
    validateRequiredFields(body, ['id', 'name', 'surname', 'email', 'phoneNumber', 'fiscalCode']);
    
    const patient = await PatientService.createPatient(body);
    
    return c.json(createApiResponse(patient, {
        message: 'Patient created successfully',
        description: 'A new patient has been added to the system',
        context: 'patient-creation'
    }), 201);
});

// PUT /patients/:id - Update a patient
patientRoutes.put('/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json();
    const patient = await PatientService.updatePatient(id, body);
    
    return c.json(createApiResponse(patient, {
        message: 'Patient updated successfully',
        description: 'Patient information has been updated',
        context: 'patient-update'
    }));
});

// DELETE /patients/:id - Delete a patient
patientRoutes.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await PatientService.deletePatient(id);
    
    return c.json(createApiResponse(null, {
        message: 'Patient deleted successfully',
        description: 'Patient has been removed from the system',
        context: 'patient-deletion'
    }));
});

export default patientRoutes;
