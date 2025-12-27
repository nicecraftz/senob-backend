export interface TreatmentAttachment {
    type: 'file' | 'text';
    data: string; // Either the string content or the filename of the file (for backward compatibility)
    path?: string; // Full path to the file on the server
    originalName?: string; // Original filename when uploaded
}

export interface Patient {
    _id?: string;
    id: number;
    name: string;
    surname: string;
    email: string;
    phoneNumber: string;
    dateOfBirth: string;
    address: string;
    fiscalCode: string;
    anamnesi?: string;
    treatments: Treatment[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Treatment {
    _id?: string;
    id: number;
    patientId: number;
    date: string | Date;
    content: string;
    attachemnts: TreatmentAttachment[]; // Note: matches frontend typo
    aiAnalysis?: string | null; // AI-generated analysis of the treatment
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Appointment {
    _id?: string;
    id: number;
    patientId: number;
    date: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

