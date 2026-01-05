import { HTTPError } from '../utils/errors';
import { Patient, Treatment } from '../models';
import { SerializedAppointment } from './appointmentService';

interface OllamaResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    context?: number[];
    total_duration?: number;
    load_duration?: number;
    prompt_eval_count?: number;
    prompt_eval_duration?: number;
    eval_count?: number;
    eval_duration?: number;
}

interface OllamaRequest {
    model: string;
    prompt: string;
    stream?: boolean;
    options?: {
        temperature?: number;
        top_p?: number;
        top_k?: number;
    };
}

const SYSTEM_PROMPT = `
### Instructions

Agisci come un redattore di cartelle cliniche. Il tuo unico compito è sintetizzare i dati forniti senza aggiungere interpretazioni, consigli terapeutici o suggerimenti diagnostici.

**Regole di Formattazione e Stile:**
- Inizia direttamente con i dati (es. "Paziente di [età] anni...").
- NON inserire titoli (es. no "Riassunto Clinico:"), intestazioni o etichette di sezione.
- NON utilizzare formule di cortesia o preamboli.
- Usa esclusivamente il registro medico oggettivo (es. "riferisce", "presenta", "anamnesi silente").

**Regole di Contenuto (Sintesi Pura):**
- Riassumi l'anamnesi e i trattamenti in 1-2 paragrafi fluidi.
- Se un'informazione (come la timeline dei trattamenti) è assente, NON menzionarla e NON scrivere che è assente; limitati a riportare solo ciò che è noto.
- **DIVIETO ASSOLUTO**: Non inserire raccomandazioni, non suggerire esami, non proporre programmi di riabilitazione o diagnosi differenziali. Limitatevi ai fatti riportati nell'input.
- Elimina ogni ridondanza: se un sintomo è già stato citato nel paragrafo precedente, non ripeterlo nelle osservazioni.

### Input
`;

/**
 * Service for interacting with Ollama API for AI-powered features
 */
export class OllamaService {
    private static readonly DEFAULT_BASE_URL = 'http://localhost:11434';
    private static readonly DEFAULT_MODEL = 'gemma3:1b';
    private static readonly DEFAULT_TIMEOUT = 60000; // 60 seconds

    /**
     * Get the base URL for Ollama API
     */
    private static getBaseUrl(): string {
        return process.env.OLLAMA_BASE_URL || this.DEFAULT_BASE_URL;
    }

    /**
     * Get the model name to use
     */
    private static getModel(): string {
        return process.env.OLLAMA_MODEL || this.DEFAULT_MODEL;
    }

    /**
     * Check if Ollama is available
     */
    static async checkAvailability(): Promise<boolean> {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await fetch(`${baseUrl}/api/tags`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000), // 5 second timeout for health check
            });

            return response.ok;
        } catch (error) {
            console.error('Ollama availability check failed:', error);
            return false;
        }
    }

    /**
     * Generate a response from Ollama
     */
    private static async generateResponse(prompt: string, options?: {
        temperature?: number;
        top_p?: number;
        top_k?: number;
    }): Promise<string> {
        const baseUrl = this.getBaseUrl();
        const model = this.getModel();

        const requestBody: OllamaRequest = {
            model,
            prompt,
            stream: false,
            options: {
                temperature: options?.temperature ?? 0.7,
                top_p: options?.top_p ?? 0.9,
                top_k: options?.top_k ?? 40,
            },
        };

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.DEFAULT_TIMEOUT);

            const response = await fetch(`${baseUrl}/api/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorText = await response.text();
                throw new HTTPError(
                    `Ollama API error: ${response.status} ${response.statusText}. ${errorText}`,
                    502,
                    'Ollama Service Error'
                );
            }

            const data: OllamaResponse = await response.json();

            if (!data.done || !data.response) {
                throw new HTTPError(
                    'Incomplete response from Ollama',
                    502,
                    'Ollama Service Error'
                );
            }

            return data.response.trim();
        } catch (error) {
            if (error instanceof HTTPError) {
                throw error;
            }

            if (error instanceof Error && error.name === 'AbortError') {
                throw new HTTPError(
                    'Request to Ollama timed out',
                    504,
                    'Ollama Service Error'
                );
            }

            throw new HTTPError(
                `Failed to communicate with Ollama: ${error instanceof Error ? error.message : 'Unknown error'}`,
                502,
                'Ollama Service Error'
            );
        }
    }

    /**
     * Generate a comprehensive patient summary
     */
    static async generatePatientSummary(
        patient: Patient,
        treatments: Treatment[],
        appointments: SerializedAppointment[]
    ): Promise<string> {
        // Build the prompt with patient information
        const prompt = this.buildPatientSummaryPrompt(patient, treatments, appointments);

        // Generate the summary
        const summary = await this.generateResponse(prompt, {
            temperature: 0.5, // Lower temperature for more factual, consistent summaries
            top_p: 0.9,
        });

        return summary;
    }

    /**
     * Build a comprehensive prompt for patient summary generation
     */
    private static buildPatientSummaryPrompt(
        patient: Patient,
        treatments: Treatment[],
        appointments: SerializedAppointment[]
    ): string {
        // Calculate age from date of birth
        let age: number | null = null;
        if (patient.dateOfBirth) {
            const birthDate = new Date(patient.dateOfBirth);
            const today = new Date();
            age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
        }

        const patientInfo = `
PATIENT INFORMATION:
${age !== null ? `- Age: ${age} years old` : ''}
${patient.anamnesi ? `- Medical History (Anamnesi): ${patient.anamnesi}` : '- Medical History (Anamnesi): Not provided'}
`;

        const treatmentsInfo = treatments.length > 0 ? `
TREATMENT HISTORY (${treatments.length} treatments):
${treatments
    .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // Most recent first
    })
    .map((treatment, index) => {
        const treatmentDate = new Date(treatment.date).toLocaleDateString();
        const attachmentsInfo = treatment.attachemnts && treatment.attachemnts.length > 0
            ? ` (${treatment.attachemnts.length} attachment${treatment.attachemnts.length > 1 ? 's' : ''})`
            : '';
        return `
Treatment #${index + 1} - Date: ${treatmentDate}${attachmentsInfo}
Content: ${treatment.content}
`;
    })
    .join('\n')}
` : `
TREATMENT HISTORY: No treatments recorded.
`;

        const appointmentsInfo = appointments.length > 0 ? `
APPOINTMENT HISTORY (${appointments.length} appointments):
${appointments
    .sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA; // Most recent first
    })
    .map((appointment, index) => {
        const appointmentDate = new Date(appointment.date).toLocaleDateString();
        return `Appointment #${index + 1} - Date: ${appointmentDate}`;
    })
    .join('\n')}
` : `
APPOINTMENT HISTORY: No appointments recorded.
`;
        return `${SYSTEM_PROMPT} ${patientInfo} ${treatmentsInfo} ${appointmentsInfo}`;
    }
}

