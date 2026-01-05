import { Patient } from '../models';

export interface CreatePatientRequest {
    id: number;
    name: string;
    surname: string;
    email: string;
    phoneNumber: string;
    dateOfBirth?: string;
    address?: string;
    fiscalCode: string;
    anamnesi?: string;
    treatments?: any[];
}

export interface UpdatePatientRequest {
    name?: string;
    surname?: string;
    email?: string;
    phoneNumber?: string;
    dateOfBirth?: string;
    address?: string;
    fiscalCode?: string;
    anamnesi?: string;
    treatments?: any[];
}

export interface PatientResponse {
    patient: Patient | null;
}

