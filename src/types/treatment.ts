import { Treatment, TreatmentAttachment } from '../models';

export interface CreateTreatmentRequest {
    id: number;
    patientId: number;
    date: string | Date;
    content: string;
    attachemnts?: TreatmentAttachment[];
}

export interface UpdateTreatmentRequest {
    patientId?: number;
    date?: string | Date;
    content?: string;
    attachemnts?: TreatmentAttachment[];
    aiAnalysis?: any;
}

export interface TreatmentQueryParams {
    patientId?: string;
}

export interface TreatmentResponse {
    treatment: Treatment | null;
}

export interface FileUploadRequest {
    treatmentId: string;
    files: File[];
}

