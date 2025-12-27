import { Hono } from 'hono';
import { treatmentsCollection } from '../database';
import { Treatment, TreatmentAttachment } from '../models';
import { createApiResponse } from '../types/api';
import { ObjectId } from 'mongodb';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { HTTPError } from '../utils/errors';

const treatmentRoutes = new Hono();

// Directory for storing treatment attachments
const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR || join(process.cwd(), 'attachments');

// Ensure attachments directory exists
async function ensureAttachmentsDir() {
    if (!existsSync(ATTACHMENTS_DIR)) {
        await mkdir(ATTACHMENTS_DIR, { recursive: true });
    }
}

// Initialize attachments directory on module load
ensureAttachmentsDir().catch(console.error);

// Normalize attachments to ensure they always have a path
function normalizeAttachments(attachments: TreatmentAttachment[] | undefined): TreatmentAttachment[] {
    if (!attachments) return [];
    return attachments.map(attachment => {
        if (attachment.type === 'file' && !attachment.path && attachment.data) {
            // Reconstruct path for legacy attachments that don't have it
            return {
                ...attachment,
                path: join(ATTACHMENTS_DIR, attachment.data)
            };
        }
        return attachment;
    });
}

// Normalize treatment to ensure attachments have paths
function normalizeTreatment(treatment: any): any {
    if (!treatment) return treatment;
    return {
        ...treatment,
        attachemnts: normalizeAttachments(treatment.attachemnts)
    };
}

// GET /treatments - Get all treatments
treatmentRoutes.get('/', async (c) => {
    if (!treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const patientId = c.req.query('patientId');
    const query = patientId ? { patientId: Number(patientId) } : {};

    const treatments = await treatmentsCollection.find(query).sort({ date: -1 }).toArray();
    const normalizedTreatments = treatments.map(normalizeTreatment);
    return c.json(createApiResponse(normalizedTreatments));
});

// GET /treatments/:id - Get treatment by ID
treatmentRoutes.get('/:id', async (c) => {
    if (!treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const id = c.req.param('id');
    const treatment = await treatmentsCollection.findOne(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    if (!treatment) {
        throw new HTTPError('Treatment not found', 404, 'Not Found');
    }

    const normalizedTreatment = normalizeTreatment(treatment);
    return c.json(createApiResponse(normalizedTreatment));
});

// POST /treatments/file-submit - Upload files for a treatment
treatmentRoutes.post('/file-submit', async (c) => {
    if (!treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    await ensureAttachmentsDir();

    const contentType = c.req.header('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
        throw new HTTPError('Content-Type must be multipart/form-data', 400, 'Validation Error');
    }

    const formData = await c.req.formData();
    const treatmentId = formData.get('treatmentId')?.toString();
    
    if (!treatmentId) {
        throw new HTTPError('Missing treatmentId', 400, 'Validation Error');
    }

    // Find the treatment
    const treatment = await treatmentsCollection.findOne(
        (ObjectId.isValid(treatmentId)
            ? { $or: [{ _id: new ObjectId(treatmentId) }, { id: Number(treatmentId) }] }
            : { id: Number(treatmentId) }) as any
    );

    if (!treatment) {
        throw new HTTPError('Treatment not found', 404, 'Not Found');
    }

    // Handle file uploads
    const files = formData.getAll('files');
    const newAttachments: TreatmentAttachment[] = [];
    
    for (const file of files) {
        if (file instanceof File) {
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
            const filePath = join(ATTACHMENTS_DIR, fileName);
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await writeFile(filePath, buffer);
            newAttachments.push({
                type: 'file',
                data: fileName,
                path: filePath,
                originalName: file.name
            });
        }
    }

    // Update treatment with new attachments
    const existingAttachments = treatment.attachemnts || [];
    const updatedAttachments = [...existingAttachments, ...newAttachments];

    const result = await treatmentsCollection.findOneAndUpdate(
        (ObjectId.isValid(treatmentId)
            ? { $or: [{ _id: new ObjectId(treatmentId) }, { id: Number(treatmentId) }] }
            : { id: Number(treatmentId) }) as any,
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

    return c.json(createApiResponse(newAttachments, {
        message: 'Files uploaded successfully',
        description: 'Files have been uploaded and attached to the treatment',
        context: 'file-upload'
    }), 201);
});

// POST /treatments - Create a new treatment (JSON only)
treatmentRoutes.post('/', async (c) => {
    if (!treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const body = await c.req.json();

    const {
        id,
        patientId,
        date,
        content
    } = body;

    // Validation
    if (id === undefined || patientId === undefined || !date || !content) {
        throw new HTTPError('Missing required fields', 400, 'Validation Error');
    }

    // Check if id already exists
    const existingTreatment = await treatmentsCollection.findOne({ id: Number(id) });
    if (existingTreatment) {
        throw new HTTPError('Treatment ID already exists', 409, 'Conflict');
    }

    const now = new Date();
    const newTreatment: Treatment = {
        id: Number(id),
        patientId: Number(patientId),
        date: typeof date === 'string' ? date : date,
        content,
        attachemnts: body.attachemnts || [],
        createdAt: now,
        updatedAt: now
    };

    const result = await treatmentsCollection.insertOne(newTreatment);
    const createdTreatment = await treatmentsCollection.findOne({ _id: result.insertedId });
    const normalizedTreatment = normalizeTreatment(createdTreatment);

    return c.json(createApiResponse(normalizedTreatment, {
        message: 'Treatment created successfully',
        description: 'A new treatment has been added to the system',
        context: 'treatment-creation'
    }), 201);
});

// PUT /treatments/:id - Update a treatment
treatmentRoutes.put('/:id', async (c) => {
    if (!treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    await ensureAttachmentsDir();

    const id = c.req.param('id');
    const contentType = c.req.header('content-type') || '';
    let body: any;
    let newAttachemnts: TreatmentAttachment[] = [];

    // Handle multipart/form-data (file uploads)
    if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData();
        
        body = {
            patientId: formData.get('patientId')?.toString(),
            date: formData.get('date')?.toString(),
            content: formData.get('content')?.toString(),
            attachemnts: formData.get('attachemnts')?.toString()
        };

        // Handle new file uploads
        const files = formData.getAll('newAttachments');
        for (const file of files) {
            if (file instanceof File) {
                const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
                const filePath = join(ATTACHMENTS_DIR, fileName);
                const arrayBuffer = await file.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                await writeFile(filePath, buffer);
                newAttachemnts.push({
                    type: 'file',
                    data: fileName,
                    path: filePath,
                    originalName: file.name
                });
            }
        }
    } else {
        body = await c.req.json();
    }

    const { patientId, date, content, attachemnts } = body;

    // Get existing treatment to preserve existing attachemnts
    const existingTreatment = await treatmentsCollection.findOne(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    if (!existingTreatment) {
        throw new HTTPError('Treatment not found', 404, 'Not Found');
    }

    const updateData: Partial<Treatment> = {
        updatedAt: new Date()
    };

    if (patientId !== undefined) updateData.patientId = Number(patientId);
    if (date !== undefined) updateData.date = date;
    if (content !== undefined) updateData.content = content;
    // Preserve aiAnalysis if not provided in update (it's managed separately via AI endpoint)
    if (body.aiAnalysis !== undefined) {
        updateData.aiAnalysis = body.aiAnalysis;
    }
    if (attachemnts !== undefined) {
        // Merge existing attachemnts with new ones
        const existingAttachemnts = existingTreatment.attachemnts || [];
        updateData.attachemnts = [...existingAttachemnts, ...newAttachemnts];
    } else if (newAttachemnts.length > 0) {
        // Add new attachemnts to existing ones
        const existingAttachemnts = existingTreatment.attachemnts || [];
        updateData.attachemnts = [...existingAttachemnts, ...newAttachemnts];
    }

    const result = await treatmentsCollection.findOneAndUpdate(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any,
        { $set: updateData },
        { returnDocument: 'after' }
    );

    if (!result) {
        throw new HTTPError('Treatment not found', 404, 'Not Found');
    }

    const normalizedResult = normalizeTreatment(result);
    return c.json(createApiResponse(normalizedResult, {
        message: 'Treatment updated successfully',
        description: 'Treatment information has been updated',
        context: 'treatment-update'
    }));
});

// DELETE /treatments/:id - Delete a treatment
treatmentRoutes.delete('/:id', async (c) => {
    if (!treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const id = c.req.param('id');
    const treatment = await treatmentsCollection.findOne(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    if (!treatment) {
        throw new HTTPError('Treatment not found', 404, 'Not Found');
    }

    // Delete associated attachment files
    if (treatment.attachemnts && treatment.attachemnts.length > 0) {
        for (const attachment of treatment.attachemnts) {
            if (attachment.type === 'file') {
                try {
                    // Use path if available, otherwise construct from data
                    const filePath = attachment.path || join(ATTACHMENTS_DIR, attachment.data);
                    if (existsSync(filePath)) {
                        await unlink(filePath);
                    }
                } catch (error) {
                    console.error(`Error deleting attachment ${attachment.data}:`, error);
                    // Continue even if file deletion fails
                }
            }
        }
    }

    const result = await treatmentsCollection.findOneAndDelete(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    return c.json(createApiResponse(null, {
        message: 'Treatment deleted successfully',
        description: 'Treatment has been removed from the system',
        context: 'treatment-deletion'
    }));
});

// DELETE /treatments/:id/attachments/:attachmentName - Delete a specific attachment
treatmentRoutes.delete('/:id/attachments/:attachmentName', async (c) => {
    if (!treatmentsCollection) {
        throw new HTTPError('Database not initialized', 500, 'Database Error');
    }

    const id = c.req.param('id');
    const attachmentName = c.req.param('attachmentName');

    const treatment = await treatmentsCollection.findOne(
        (ObjectId.isValid(id)
            ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
            : { id: Number(id) }) as any
    );

    if (!treatment) {
        throw new HTTPError('Treatment not found', 404, 'Not Found');
    }

    // Remove attachment from array
    const updatedAttachemnts = (treatment.attachemnts || []).filter(
        (att) => !(att.type === 'file' && att.data === attachmentName)
    );

    // Delete file from filesystem
    try {
        // Find the attachment to get its path if available
        const attachment = treatment.attachemnts?.find(
            (att) => att.type === 'file' && att.data === attachmentName
        );
        const filePath = attachment?.path || join(ATTACHMENTS_DIR, attachmentName);
        if (existsSync(filePath)) {
            await unlink(filePath);
        }
    } catch (error) {
        console.error(`Error deleting attachment file ${attachmentName}:`, error);
    }

        // Update treatment
        const result = await treatmentsCollection.findOneAndUpdate(
            (ObjectId.isValid(id)
                ? { $or: [{ _id: new ObjectId(id) }, { id: Number(id) }] }
                : { id: Number(id) }) as any,
            {
                $set: {
                    attachemnts: updatedAttachemnts,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

    const normalizedResult = normalizeTreatment(result);
    return c.json(createApiResponse(normalizedResult, {
        message: 'Attachment deleted successfully',
        description: 'Attachment has been removed from the treatment',
        context: 'attachment-deletion'
    }));
});

export default treatmentRoutes;

