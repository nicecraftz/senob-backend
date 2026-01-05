import { Appointment } from '../models';

export interface CreateAppointmentRequest {
    patientId: number;
    date: string | Date;
}

export interface UpdateAppointmentRequest {
    patientId?: number;
    date?: string | Date;
}

export interface AppointmentQueryParams {
    patientId?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
}

export interface AppointmentResponse {
    appointment: Appointment | null;
}

