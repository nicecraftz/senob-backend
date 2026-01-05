import { Hono } from 'hono';
import { TreatmentService } from '../services/treatmentService';
import { createApiResponse } from '../types/api';
import { TreatmentQueryParams } from '../types/treatment';
import { validateRequiredFields, validateContentType } from '../utils/validation';
import { HTTPError } from '../utils/errors';
import { initAttachmentsDir } from '../utils/fileHandler';

const treatmentRoutes = new Hono();

// Initialize attachments directory on module load
initAttachmentsDir().catch(console.error);

// GET /treatments - Get all treatments
treatmentRoutes.get('/', async (c) => {
    const params: TreatmentQueryParams = {
        patientId: c.req.query('patientId')
    };

    const treatments = await TreatmentService.getAllTreatments(params);
    return c.json(createApiResponse(treatments));
});

// GET /treatments/:id - Get treatment by ID
treatmentRoutes.get('/:id', async (c) => {
    const id = c.req.param('id');
    const treatment = await TreatmentService.getTreatmentById(id);
    return c.json(createApiResponse(treatment));
});

// POST /treatments/file-submit - Upload files for a treatment
treatmentRoutes.post('/file-submit', async (c) => {
    const contentType = c.req.header('content-type') || '';
    validateContentType(contentType, 'multipart/form-data');

    const formData = await c.req.formData();
    const treatmentId = formData.get('treatmentId')?.toString();
    
    if (!treatmentId) {
        throw new HTTPError('Missing treatmentId', 400, 'Validation Error');
    }

    // Extract files from form data
    const files: File[] = [];
    const fileEntries = formData.getAll('files');
    for (const file of fileEntries) {
        if (file instanceof File) {
            files.push(file);
        }
    }

    const newAttachments = await TreatmentService.uploadFiles(treatmentId, files);

    return c.json(createApiResponse(newAttachments, {
        message: 'Files uploaded successfully',
        description: 'Files have been uploaded and attached to the treatment',
        context: 'file-upload'
    }), 201);
});

// POST /treatments - Create a new treatment (JSON only)
treatmentRoutes.post('/', async (c) => {
    const body = await c.req.json();
    
    validateRequiredFields(body, ['id', 'patientId', 'date', 'content']);
    
    const treatment = await TreatmentService.createTreatment(body);
    
    return c.json(createApiResponse(treatment, {
        message: 'Treatment created successfully',
        description: 'A new treatment has been added to the system',
        context: 'treatment-creation'
    }), 201);
});

// PUT /treatments/:id - Update a treatment
treatmentRoutes.put('/:id', async (c) => {
    const id = c.req.param('id');
    const contentType = c.req.header('content-type') || '';
    
    let body: any;
    let newFiles: File[] = [];

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
        const fileEntries = formData.getAll('newAttachments');
        for (const file of fileEntries) {
            if (file instanceof File) {
                newFiles.push(file);
            }
        }
    } else {
        body = await c.req.json();
    }

    // If there are new files, upload them first
    if (newFiles.length > 0) {
        const newAttachments = await TreatmentService.uploadFiles(id, newFiles);
        // Merge with existing attachments in the update
        const existingAttachments = body.attachemnts || [];
        body.attachemnts = [...existingAttachments, ...newAttachments];
    }

    const treatment = await TreatmentService.updateTreatment(id, body);
    
    return c.json(createApiResponse(treatment, {
        message: 'Treatment updated successfully',
        description: 'Treatment information has been updated',
        context: 'treatment-update'
    }));
});

// DELETE /treatments/:id - Delete a treatment
treatmentRoutes.delete('/:id', async (c) => {
    const id = c.req.param('id');
    await TreatmentService.deleteTreatment(id);
    
    return c.json(createApiResponse(null, {
        message: 'Treatment deleted successfully',
        description: 'Treatment has been removed from the system',
        context: 'treatment-deletion'
    }));
});

// DELETE /treatments/:id/attachments/:attachmentName - Delete a specific attachment
treatmentRoutes.delete('/:id/attachments/:attachmentName', async (c) => {
    const id = c.req.param('id');
    const attachmentName = c.req.param('attachmentName');
    
    const treatment = await TreatmentService.deleteAttachment(id, attachmentName);
    
    return c.json(createApiResponse(treatment, {
        message: 'Attachment deleted successfully',
        description: 'Attachment has been removed from the treatment',
        context: 'attachment-deletion'
    }));
});

export default treatmentRoutes;
