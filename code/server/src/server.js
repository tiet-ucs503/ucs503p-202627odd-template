import dotenv from 'dotenv';
dotenv.config();

import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    app.listen(PORT, () => {
      console.log(`[CPRecal API] Server running on http://localhost:${PORT}`);
      console.log(`[CPRecal API] Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('[CPRecal API] Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
