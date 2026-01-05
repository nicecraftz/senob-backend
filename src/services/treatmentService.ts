import { treatmentsCollection } from '../database';
import { Treatment, TreatmentAttachment } from '../models';
import { HTTPError } from '../utils/errors';
import { buildIdQuery } from '../utils/queryBuilder';
import { validateRequiredFields } from '../utils/validation';
import { CreateTreatmentRequest, UpdateTreatmentRequest, TreatmentQueryParams } from '../types/treatment';
import { saveFile, deleteAttachmentFiles, normalizeAttachments } from '../utils/fileHandler';

/**
 * Service for treatment-related business logic
 */
export class TreatmentService {
    /**
     * Get all treatments with optional filters
     */
    static async getAllTreatments(params: TreatmentQueryParams): Promise<Treatment[]> {
        if (!treatmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const query = params.patientId ? { patientId: Number(params.patientId) } : {};
        const treatments = await treatmentsCollection.find(query).sort({ date: -1 }).toArray();
        
        return treatments.map(treatment => this.normalizeTreatment(treatment));
    }

    /**
     * Get treatment by ID
     */
    static async getTreatmentById(id: string): Promise<Treatment> {
        if (!treatmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const treatment = await treatmentsCollection.findOne(buildIdQuery(id) as any);

        if (!treatment) {
            throw new HTTPError('Treatment not found', 404, 'Not Found');
        }

        return this.normalizeTreatment(treatment);
    }

    /**
     * Create a new treatment
     */
    static async createTreatment(data: CreateTreatmentRequest): Promise<Treatment> {
        if (!treatmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        validateRequiredFields(data, ['id', 'patientId', 'date', 'content']);

        // Check if id already exists
        const existingTreatment = await treatmentsCollection.findOne({ id: Number(data.id) });
        if (existingTreatment) {
            throw new HTTPError('Treatment ID already exists', 409, 'Conflict');
        }

        const now = new Date();
        const newTreatment: Treatment = {
            id: Number(data.id),
            patientId: Number(data.patientId),
            date: typeof data.date === 'string' ? data.date : data.date,
            content: data.content,
            attachemnts: data.attachemnts || [],
            createdAt: now,
            updatedAt: now
        };

        const result = await treatmentsCollection.insertOne(newTreatment);
        const createdTreatment = await treatmentsCollection.findOne({ _id: result.insertedId });

        if (!createdTreatment) {
            throw new HTTPError('Failed to create treatment', 500, 'Server Error');
        }

        return this.normalizeTreatment(createdTreatment);
    }

    /**
     * Update a treatment
     */
    static async updateTreatment(id: string, data: UpdateTreatmentRequest): Promise<Treatment> {
        if (!treatmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        // Get existing treatment to preserve existing attachments
        const existingTreatment = await treatmentsCollection.findOne(buildIdQuery(id) as any);

        if (!existingTreatment) {
            throw new HTTPError('Treatment not found', 404, 'Not Found');
        }

        const updateData: Partial<Treatment> = {
            updatedAt: new Date()
        };

        if (data.patientId !== undefined) updateData.patientId = Number(data.patientId);
        if (data.date !== undefined) updateData.date = data.date;
        if (data.content !== undefined) updateData.content = data.content;
        if (data.aiAnalysis !== undefined) updateData.aiAnalysis = data.aiAnalysis;
        if (data.attachemnts !== undefined) {
            updateData.attachemnts = data.attachemnts;
        }

        const result = await treatmentsCollection.findOneAndUpdate(
            buildIdQuery(id) as any,
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new HTTPError('Treatment not found', 404, 'Not Found');
        }

        return this.normalizeTreatment(result);
    }

    /**
     * Upload files for a treatment
     */
    static async uploadFiles(treatmentId: string, files: File[]): Promise<TreatmentAttachment[]> {
        if (!treatmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        // Find the treatment
        const treatment = await treatmentsCollection.findOne(buildIdQuery(treatmentId) as any);

        if (!treatment) {
            throw new HTTPError('Treatment not found', 404, 'Not Found');
        }

        // Save files
        const newAttachments: TreatmentAttachment[] = [];
        for (const file of files) {
            const { fileName, filePath } = await saveFile(file);
            newAttachments.push({
                type: 'file',
                data: fileName,
                path: filePath,
                originalName: file.name
            });
        }

        // Update treatment with new attachments
        const existingAttachments = treatment.attachemnts || [];
        const updatedAttachments = [...existingAttachments, ...newAttachments];

        const result = await treatmentsCollection.findOneAndUpdate(
            buildIdQuery(treatmentId) as any,
            {
                $set: {
                    attachemnts: updatedAttachments,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new HTTPError('Treatment not found', 404, 'Not Found');
        }

        return newAttachments;
    }

    /**
     * Delete a treatment
     */
    static async deleteTreatment(id: string): Promise<void> {
        if (!treatmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const treatment = await treatmentsCollection.findOne(buildIdQuery(id) as any);

        if (!treatment) {
            throw new HTTPError('Treatment not found', 404, 'Not Found');
        }

        // Delete associated attachment files
        if (treatment.attachemnts && treatment.attachemnts.length > 0) {
            await deleteAttachmentFiles(treatment.attachemnts);
        }

        const result = await treatmentsCollection.findOneAndDelete(buildIdQuery(id) as any);

        if (!result) {
            throw new HTTPError('Treatment not found', 404, 'Not Found');
        }
    }

    /**
     * Delete a specific attachment from a treatment
     */
    static async deleteAttachment(treatmentId: string, attachmentName: string): Promise<Treatment> {
        if (!treatmentsCollection) {
            throw new HTTPError('Database not initialized', 500, 'Database Error');
        }

        const treatment = await treatmentsCollection.findOne(buildIdQuery(treatmentId) as any);

        if (!treatment) {
            throw new HTTPError('Treatment not found', 404, 'Not Found');
        }

        // Find and remove attachment
        const attachment = treatment.attachemnts?.find(
            (att) => att.type === 'file' && att.data === attachmentName
        );

        if (attachment && attachment.type === 'file') {
            // Delete file from filesystem
            try {
                const filePath = attachment.path || attachment.data;
                await deleteAttachmentFiles([attachment]);
            } catch (error) {
                console.error(`Error deleting attachment file ${attachmentName}:`, error);
            }
        }

        // Remove attachment from array
        const updatedAttachemnts = (treatment.attachemnts || []).filter(
            (att) => !(att.type === 'file' && att.data === attachmentName)
        );

        // Update treatment
        const result = await treatmentsCollection.findOneAndUpdate(
            buildIdQuery(treatmentId) as any,
            {
                $set: {
                    attachemnts: updatedAttachemnts,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) {
            throw new HTTPError('Treatment not found', 404, 'Not Found');
        }

        return this.normalizeTreatment(result);
    }

    /**
     * Normalize treatment to ensure attachments have paths
     */
    private static normalizeTreatment(treatment: any): Treatment {
        if (!treatment) return treatment;
        return {
            ...treatment,
            attachemnts: normalizeAttachments(treatment.attachemnts)
        };
    }
}

