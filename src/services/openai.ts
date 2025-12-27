import OpenAI from 'openai';
import { HTTPError } from '../utils/errors';

let openaiClient: OpenAI | null = null;

/**
 * Initialize OpenAI client with API key from environment
 * Returns null if API key is not configured
 */
export function getOpenAIClient(): OpenAI | null {
    if (openaiClient !== null) {
        return openaiClient;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey.trim() === '') {
        console.warn('OpenAI API key not configured. AI features will be disabled.');
        return null;
    }

    try {
        openaiClient = new OpenAI({
            apiKey: apiKey.trim(),
        });
        return openaiClient;
    } catch (error) {
        console.error('Failed to initialize OpenAI client:', error);
        return null;
    }
}

/**
 * Check if OpenAI is available
 */
export function isOpenAIAvailable(): boolean {
    return getOpenAIClient() !== null;
}

/**
 * Generate AI analysis for a treatment
 */
export async function generateTreatmentAnalysis(treatmentContent: string, anamnesi?: string): Promise<string> {
    const client = getOpenAIClient();

    if (!client) {
        throw new HTTPError(
            'OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.',
            503,
            'Service Unavailable'
        );
    }

    try {
        // Build user content with treatment and anamnesi if available
        let userContent = treatmentContent;
        if (anamnesi && anamnesi.trim() !== '') {
            userContent = `ANAMNESI DEL PAZIENTE:\n${anamnesi}\n\n---\n\nTRATTAMENTO:\n${treatmentContent}`;
        }

        const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Agisci come agente di supporto clinico per medici, usa esclusivamente conoscenze mediche consolidate ed evidenze riconosciute, non sostituire il medico né fornire diagnosi o terapie definitive, opera come supporto decisionale. Dato un trattamento già eseguito analizza cause di risposta subottimale o sintomi persistenti, considera meccanismi fisiopatologici, effetti avversi, comorbilità e fattori di rischio, proponi ipotesi cliniche, approfondimenti mirati e possibili ottimizzazioni valutando benefici e rischi, richiedi dati clinici mancanti quando necessari, mantieni linguaggio tecnico, conciso e orientato alla sicurezza del paziente, usa solo testo semplice senza markdown e senza andare a capo se non indispensabile. Quando disponibile, considera l\'anamnesi del paziente per fornire un\'analisi più contestualizzata e accurata. Limitati a 150 parole massime.'
                },
                {
                    role: 'user',
                    content: userContent
                }
            ],
            temperature: 0.7,
            max_tokens: 1000,
        });

        const analysis = completion.choices[0]?.message?.content;

        if (!analysis) {
            throw new HTTPError(
                'Failed to generate AI analysis',
                500,
                'AI Generation Error'
            );
        }

        return analysis;
    } catch (error: any) {
        if (error instanceof HTTPError) {
            throw error;
        }

        // Handle OpenAI API errors
        if (error?.status === 401 || error?.status === 403) {
            throw new HTTPError(
                'Invalid OpenAI API key. Please check your OPENAI_API_KEY environment variable.',
                503,
                'Service Unavailable'
            );
        }

        if (error?.status === 429) {
            throw new HTTPError(
                'OpenAI API rate limit exceeded. Please try again later.',
                429,
                'Rate Limit Exceeded'
            );
        }

        throw new HTTPError(
            `Failed to generate AI analysis: ${error?.message || 'Unknown error'}`,
            500,
            'AI Generation Error'
        );
    }
}
