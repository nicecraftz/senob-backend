import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { TreatmentAttachment } from '../models';

const ATTACHMENTS_DIR = process.env.ATTACHMENTS_DIR || join(process.cwd(), 'attachments');

/**
 * Ensure attachments directory exists
 */
export async function ensureAttachmentsDir(): Promise<void> {
    if (!existsSync(ATTACHMENTS_DIR)) {
        await mkdir(ATTACHMENTS_DIR, { recursive: true });
    }
}

/**
 * Initialize attachments directory
 */
export async function initAttachmentsDir(): Promise<void> {
    await ensureAttachmentsDir();
}

/**
 * Generate a unique filename
 */
export function generateFileName(originalName: string): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}-${originalName}`;
}

/**
 * Save a file to the attachments directory
 */
export async function saveFile(file: File): Promise<{ fileName: string; filePath: string }> {
    await ensureAttachmentsDir();
    
    const fileName = generateFileName(file.name);
    const filePath = join(ATTACHMENTS_DIR, fileName);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    await writeFile(filePath, buffer);
    
    return { fileName, filePath };
}

/**
 * Delete a file from the filesystem
 */
export async function deleteFile(filePath: string): Promise<void> {
    if (existsSync(filePath)) {
        await unlink(filePath);
    }
}

/**
 * Delete attachment files
 */
export async function deleteAttachmentFiles(attachments: TreatmentAttachment[]): Promise<void> {
    for (const attachment of attachments) {
        if (attachment.type === 'file') {
            try {
                const filePath = attachment.path || join(ATTACHMENTS_DIR, attachment.data);
                await deleteFile(filePath);
            } catch (error) {
                console.error(`Error deleting attachment ${attachment.data}:`, error);
            }
        }
    }
}

/**
 * Normalize attachments to ensure they always have a path
 */
export function normalizeAttachments(attachments: TreatmentAttachment[] | undefined): TreatmentAttachment[] {
    if (!attachments) return [];
    return attachments.map(attachment => {
        if (attachment.type === 'file' && !attachment.path && attachment.data) {
            return {
                ...attachment,
                path: join(ATTACHMENTS_DIR, attachment.data)
            };
        }
        return attachment;
    });
}

/**
 * Get attachments directory path
 */
export function getAttachmentsDir(): string {
    return ATTACHMENTS_DIR;
}

