import { Hono } from 'hono';
import { OllamaService } from '../services/ollamaService';
import { PatientService } from '../services/patientService';
import { TreatmentService } from '../services/treatmentService';
import { AppointmentService } from '../services/appointmentService';
import { createApiResponse } from '../types/api';
import { HTTPError } from '../utils/errors';

const aiRoutes = new Hono();

/**
 * GET /ai/patients/:id/summary
 * Generate a comprehensive AI-powered summary for a patient
 */
aiRoutes.get('/patients/:id/summary', async (c) => {
    const patientId = c.req.param('id');

    try {
        // Check if Ollama is available
        const isAvailable = await OllamaService.checkAvailability();
        if (!isAvailable) {
            throw new HTTPError(
                'Ollama service is not available. Please ensure Ollama is running and the gemma3:1b model is installed.',
                503,
                'Service Unavailable'
            );
        }

        // Fetch patient data
        const patient = await PatientService.getPatientById(patientId);

        // Fetch all treatments for this patient
        const treatments = await TreatmentService.getAllTreatments({
            patientId: patientId,
        });

        // Fetch all appointments for this patient
        const appointments = await AppointmentService.getAllAppointments({
            patientId: patientId,
        });

        // Generate the summary using Ollama
        const summary = await OllamaService.generatePatientSummary(
            patient,
            treatments,
            appointments
        );

        return c.json(
            createApiResponse(
                {
                    patientId: patient.id,
                    patientName: `${patient.name} ${patient.surname}`,
                    summary,
                    generatedAt: new Date().toISOString(),
                    metadata: {
                        treatmentsCount: treatments.length,
                        appointmentsCount: appointments.length,
                    },
                },
                {
                    message: 'Patient summary generated successfully',
                    description: 'AI-generated comprehensive patient summary',
                    context: 'ai-summary-generation',
                }
            )
        );
    } catch (error) {
        if (error instanceof HTTPError) {
            throw error;
        }

        throw new HTTPError(
            `Failed to generate patient summary: ${error instanceof Error ? error.message : 'Unknown error'}`,
            500,
            'Server Error'
        );
    }
});

/**
 * GET /ai/health
 * Check if Ollama service is available
 */
aiRoutes.get('/health', async (c) => {
    const isAvailable = await OllamaService.checkAvailability();

    return c.json(
        createApiResponse(
            {
                available: isAvailable,
                service: 'Ollama',
                model: process.env.OLLAMA_MODEL || 'gemma3:1b',
                baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
            },
            {
                message: isAvailable
                    ? 'Ollama service is available'
                    : 'Ollama service is not available',
                description: 'AI service health check',
                context: 'ai-health-check',
            }
        ),
        isAvailable ? 200 : 503
    );
});

export default aiRoutes;

