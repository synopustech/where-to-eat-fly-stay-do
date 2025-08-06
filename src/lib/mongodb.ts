import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

// During build time, MONGODB_URI might not be available
// Only throw error in runtime (not during build)
if (!MONGODB_URI && process.env.NODE_ENV !== 'development' && typeof window === 'undefined' && !process.env.VERCEL_ENV) {
  // Allow build to continue without MONGODB_URI, but warn
  console.warn('MONGODB_URI is not defined. Database features will not work.');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// In production, reuse the connection across requests
declare global {
  var mongoose: MongooseCache | undefined;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function dbConnect(): Promise<typeof mongoose> {
  // If no MONGODB_URI or it's a dummy value, return a mock connection
  if (!MONGODB_URI || MONGODB_URI.includes('dummy')) {
    console.warn('MONGODB_URI not available or is dummy value, skipping database connection');
    // Return a promise that resolves to mongoose for type compatibility
    return Promise.resolve(mongoose);
  }

  if (cached!.conn) {
    return cached!.conn;
  }

  if (!cached!.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached!.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }

  try {
    cached!.conn = await cached!.promise;
  } catch (e) {
    cached!.promise = null;
    throw e;
  }

  return cached!.conn;
}

export default dbConnect;
