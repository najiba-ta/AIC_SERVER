const mongoose = require('mongoose');

let cachedConnection = null;

/**
 * Connect to MongoDB database using Mongoose with connection pooling / caching
 * Optimized for both traditional servers and serverless environments (Vercel)
 */
const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState >= 1) {
    return cachedConnection;
  }

  if (!process.env.MONGODB_URI) {
    console.error('[MongoDB] Error: MONGODB_URI is not defined in environment variables.');
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false,
    });
    cachedConnection = conn;
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
