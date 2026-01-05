import { patientsCollection } from '../database';
import { Patient } from '../models';
import { HTTPError } from '../utils/errors';
import { buildIdQuery } from '../utils/queryBuilder';
import { CreatePatientRequest, UpdatePatientRequest } from '../types/patient';

/**
 * Service for patient-related business logic
 */
export class PatientService {
    /**
     * Get all patients
     */
    static async getAllPatients(): Promise<Patient[]> {
        if (!patientsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        return await patientsCollection.find({}).toArray();
    }

    /**
     * Get patient by ID
     */
    static async getPatientById(id: string): Promise<Patient> {
        if (!patientsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const patient = await patientsCollection.findOne(buildIdQuery(id) as any);

        if (!patient) {
            throw new HTTPError('Patient not found', 404, 'Not Found');
        }

        return patient;
    }

    /**
     * Create a new patient
     */
    static async createPatient(data: CreatePatientRequest): Promise<Patient> {
        if (!patientsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        // Check if id already exists
        const existingPatient = await patientsCollection.findOne({ id: Number(data.id) });
        if (existingPatient) {
            throw new HTTPError('Patient ID already exists', 409, 'Conflict');
        }

        const now = new Date();
        const newPatient: Patient = {
            id: Number(data.id),
            name: data.name,
            surname: data.surname,
            email: data.email,
            phoneNumber: data.phoneNumber,
            dateOfBirth: data.dateOfBirth || new Date().toISOString(),
            address: data.address || '',
            anamnesi: data.anamnesi || '',
            treatments: data.treatments || [],
            fiscalCode: data.fiscalCode,
            createdAt: now,
            updatedAt: now
        };

        const result = await patientsCollection.insertOne(newPatient);
        const createdPatient = await patientsCollection.findOne({ _id: result.insertedId });

        if (!createdPatient) {
            throw new HTTPError('Failed to create patient', 500, 'Server Error');
        }

        return createdPatient;
    }

    /**
     * Update a patient
     */
    static async updatePatient(id: string, data: UpdatePatientRequest): Promise<Patient> {
        if (!patientsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const updateData: Partial<Patient> = {
            updatedAt: new Date()
        };

        if (data.name !== undefined) updateData.name = data.name;
        if (data.surname !== undefined) updateData.surname = data.surname;
        if (data.email !== undefined) updateData.email = data.email;
        if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
        if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth;
        if (data.address !== undefined) updateData.address = data.address;
        if (data.fiscalCode !== undefined) updateData.fiscalCode = data.fiscalCode;
        if (data.anamnesi !== undefined) updateData.anamnesi = data.anamnesi;
        if (data.treatments !== undefined) updateData.treatments = data.treatments;

        const result = await patientsCollection.findOneAndUpdate(
            buildIdQuery(id) as any,
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new HTTPError('Patient not found', 404, 'Not Found');
        }

        return result;
    }

    /**
     * Delete a patient
     */
    static async deletePatient(id: string): Promise<void> {
        if (!patientsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const result = await patientsCollection.findOneAndDelete(buildIdQuery(id) as any);

        if (!result) {
            throw new HTTPError('Patient not found', 404, 'Not Found');
        }
    }
}

