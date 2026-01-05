import { MongoClient, Db, Collection } from 'mongodb';
import { Patient, Treatment, Appointment } from './models';

// Database connection URL - defaults to local MongoDB
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'senob';

// Client instance
let client: MongoClient | null = null;
let db: Db | null = null;

// Collection references
export let patientsCollection: Collection<Patient> | null = null;
export let treatmentsCollection: Collection<Treatment> | null = null;
export let appointmentsCollection: Collection<Appointment> | null = null;

/**
 * Connect to MongoDB and initialize collections
 */
export async function connectDatabase(): Promise<void> {
    try {
        if (client && db) {
            console.log('Database already connected');
            return;
        }

        client = new MongoClient(MONGODB_URI);
        await client.connect();
        
        db = client.db(DB_NAME);
        
        // Initialize collections
        patientsCollection = db.collection<Patient>('patients');
        treatmentsCollection = db.collection<Treatment>('treatments');
        appointmentsCollection = db.collection<Appointment>('appointments');

        // Create indexes for better query performance
        await createIndexes();

        console.log(`Connected to MongoDB database: ${DB_NAME}`);
        console.log(`Initialized collections: patients, treatments, appointments`);
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        throw error;
    }
}

/**
 * Create database indexes for optimized queries
 */
async function createIndexes(): Promise<void> {
    if (!db) return;

    try {
        // Patients indexes
        await patientsCollection?.createIndex({ id: 1 }, { unique: true });
        await patientsCollection?.createIndex({ email: 1 }, { unique: true, sparse: true });
        await patientsCollection?.createIndex({ fiscalCode: 1 }, { unique: true, sparse: true });
        await patientsCollection?.createIndex({ surname: 1, name: 1 });
        
        // Treatments indexes
        await treatmentsCollection?.createIndex({ id: 1 }, { unique: true });
        await treatmentsCollection?.createIndex({ patientId: 1 });
        await treatmentsCollection?.createIndex({ date: 1 });
        
        // Appointments indexes
        await appointmentsCollection?.createIndex({ patientId: 1 });
        await appointmentsCollection?.createIndex({ date: 1 });

        console.log('Database indexes created');
    } catch (error) {
        console.error('Error creating indexes:', error);
        // Don't throw - indexes are optional optimizations
    }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
    try {
        if (client) {
            await client.close();
            client = null;
            db = null;
            patientsCollection = null;
            treatmentsCollection = null;
            appointmentsCollection = null;
            console.log('Database connection closed');
        }
    } catch (error) {
        console.error('Error closing database connection:', error);
        throw error;
    }
}

/**
 * Get database instance (use with caution, prefer using exported collections)
 */
export function getDatabase(): Db {
    if (!db) {
        throw new Error('Database not connected. Call connectDatabase() first.');
    }
    return db;
}

/**
 * Check if database is connected
 */
export function isConnected(): boolean {
    return client !== null && db !== null;
}

