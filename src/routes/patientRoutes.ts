import { Hono } from 'hono';
import { patientsCollection } from '../database';
import { Patient } from '../models';
import { createApiResponse } from '../types/api';
import { ObjectId } from 'mongodb';
import { HTTPError } from '../utils/errors';

const patientRoutes = new Hono();

// GET /patients - Get all patients
patientRoutes.get('/', async (c) => {
    if (!patientsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const patients = await patientsCollection.find({}).toArray();
    return c.json(createApiResponse(patients));
});

// GET /patients/:id - Get patient by ID
patientRoutes.get('/:id', async (c) => {
    if (!patientsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const id = c.req.param('id');
    const patient = await patientsCollection.findOne(
        (ObjectId.isValid(id) 
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    if (!patient) {
        throw new HTTPError('Patient not found', 404, 'Not Found');
    }

    return c.json(createApiResponse(patient));
});

// POST /patients - Create a new patient
patientRoutes.post('/', async (c) => {
    if (!patientsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const body = await c.req.json();
    const {
        id,
        name,
        surname,
        email,
        phoneNumber,
        dateOfBirth,
        address,
        fiscalCode,
        anamnesi,
        treatments = []
    } = body;

    // Validation
    if (id === undefined || !name || !surname || !email || !phoneNumber || !fiscalCode) {
        throw new HTTPError('Missing required fields', 400, 'Validation Error');
    }

    // Check if id already exists
    const existingPatient = await patientsCollection.findOne({ id: Number(id) });
    if (existingPatient) {
        throw new HTTPError('Patient ID already exists', 409, 'Conflict');
    }

    const now = new Date();
    const newPatient: Patient = {
        id: Number(id),
        name,
        surname,
        email,
        phoneNumber,
        dateOfBirth: dateOfBirth || new Date().toISOString(),
        address: address || '',
        anamnesi: anamnesi || '',
        treatments: treatments || [],
        fiscalCode,
        createdAt: now,
        updatedAt: now
    };

    const result = await patientsCollection.insertOne(newPatient);
    const createdPatient = await patientsCollection.findOne({ _id: result.insertedId });

    return c.json(createApiResponse(createdPatient, {
        message: 'Patient created successfully',
        description: 'A new patient has been added to the system',
        context: 'patient-creation'
    }), 201);
});

// PUT /patients/:id - Update a patient
patientRoutes.put('/:id', async (c) => {
    if (!patientsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const id = c.req.param('id');
    const body = await c.req.json();

    const {
        name,
        surname,
        email,
        phoneNumber,
        dateOfBirth,
        address,
        fiscalCode,
        anamnesi,
        treatments
    } = body;

    const updateData: Partial<Patient> = {
        updatedAt: new Date()
    };

    if (name !== undefined) updateData.name = name;
    if (surname !== undefined) updateData.surname = surname;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth;
    if (address !== undefined) updateData.address = address;
    if (fiscalCode !== undefined) updateData.fiscalCode = fiscalCode;
    if (anamnesi !== undefined) updateData.anamnesi = anamnesi;
    if (treatments !== undefined) updateData.treatments = treatments;

    const result = await patientsCollection.findOneAndUpdate(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any,
        { $set: updateData },
        { returnDocument: 'after' }
    );

    if (!result) {
        throw new HTTPError('Patient not found', 404, 'Not Found');
    }

    return c.json(createApiResponse(result, {
        message: 'Patient updated successfully',
        description: 'Patient information has been updated',
        context: 'patient-update'
    }));
});

// DELETE /patients/:id - Delete a patient
patientRoutes.delete('/:id', async (c) => {
    if (!patientsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const id = c.req.param('id');
    const result = await patientsCollection.findOneAndDelete(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    if (!result) {
        throw new HTTPError('Patient not found', 404, 'Not Found');
    }

    return c.json(createApiResponse(null, {
        message: 'Patient deleted successfully',
        description: 'Patient has been removed from the system',
        context: 'patient-deletion'
    }));
});

export default patientRoutes;

