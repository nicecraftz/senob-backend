import { Hono } from 'hono';
import { treatmentsCollection, patientsCollection } from '../database';
import { generateTreatmentAnalysis, isOpenAIAvailable } from '../services/openai';
import { createApiResponse } from '../types/api';
import { HTTPError } from '../utils/errors';
import { ObjectId } from 'mongodb';

const aiRoutes = new Hono();

/**
 * POST /api/ai/treatments/:id/analyze
 * Generate AI analysis for a treatment and save it to the database
 */
aiRoutes.post('/treatments/:id/analyze', async (c) => {
    if (!treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    // Check if OpenAI is available
    if (!isOpenAIAvailable()) {
        throw new HTTPError(
            'OpenAI API key is not configured. Please set OPENAI_API_KEY environment variable.',
            503,
            'Service Unavailable'
        );
    }

    const id = c.req.param('id');

    // Find the treatment
    const treatment = await treatmentsCollection.findOne(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    if (!treatment) {
        throw new HTTPError('Treatment not found', 404, 'Not Found');
    }

    // Get patient data to include anamnesi
    let anamnesi = '';
    if (patientsCollection && treatment.patientId) {
        const patient = await patientsCollection.findOne({ id: Number(treatment.patientId) });
        if (patient && patient.anamnesi) {
            anamnesi = patient.anamnesi;
        }
    }

    // Generate AI analysis with treatment content and anamnesi
    const analysis = await generateTreatmentAnalysis(treatment.content, anamnesi);

    // Update treatment with AI analysis
    const result = await treatmentsCollection.findOneAndUpdate(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any,
        {
            $set: {
                aiAnalysis: analysis,
                updatedAt: new Date()
            }
        },
        { returnDocument: 'after' }
    );

    if (!result) {
        throw new HTTPError('Failed to update treatment with AI analysis', 500, 'Database Error');
    }

    return c.json(createApiResponse({
        treatment: result,
        analysis: analysis
    }, {
        message: 'AI analysis generated successfully',
        description: 'The treatment has been analyzed by AI and the analysis has been saved',
        context: 'ai-analysis'
    }));
});

/**
 * GET /api/ai/status
 * Check if AI service is available
 */
aiRoutes.get('/status', async (c) => {
    const isAvailable = isOpenAIAvailable();
    
    return c.json(createApiResponse({
        available: isAvailable,
        message: isAvailable 
            ? 'AI service is available' 
            : 'AI service is not available. OPENAI_API_KEY environment variable is not set.'
    }));
});

export default aiRoutes;

