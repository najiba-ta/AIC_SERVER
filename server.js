// AIC Backend API Server - Express & MongoDB
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const connectDB = require('./src/config/db');
const apiRoutes = require('./src/routes');
const { notFoundHandler, errorHandler } = require('./src/middleware/errorMiddleware');

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware to ensure DB connection is ready on each request (crucial for serverless cold starts)
app.use(async (req, res, next) => {
  try {
    await connectDB();
  } catch (err) {
    console.error('[DB Connection Error]:', err);
  }
  next();
});

// CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);

      // Check explicit allowed origins or any vercel.app preview/production deployment
      const isAllowed =
        allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app');

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`CORS Error: Origin '${origin}' is not allowed.`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-admin-api-key'],
  })
);

// Cookie Parser Middleware
app.use(cookieParser());

// Apply express.json() conditionally so it does not interfere with raw body parsing for Stripe Webhooks
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    next();
  } else {
    express.json()(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// Root welcome route
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Welcome to Al Hidayah Islamic Center (AIC) API Server',
    status: 'online',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      authRegister: 'POST /api/auth/register',
      authLogin: 'POST /api/auth/login',
      authLogout: 'POST /api/auth/logout',
      authMe: 'GET /api/auth/me',
      authProfile: 'PUT /api/auth/profile',
      adminRegister: 'POST /api/admin/register',
      adminLogin: 'POST /api/admin/login',
      adminApplications: 'GET /api/admin/applications',
      adminApprove: 'PATCH /api/admin/applications/:id/approve',
      adminReject: 'PATCH /api/admin/applications/:id/reject',
      adminDonations: 'GET /api/admin/donations',
      adminStats: 'GET /api/admin/stats',
      adminUsers: 'GET /api/admin/users',
      admissionsSubmit: 'POST /api/admissions',
      admissionsMyApplication: 'GET /api/admissions/my-application',
      adminAdmissions: 'GET /api/admin/admissions',
      adminAdmissionApprove: 'PATCH /api/admin/admissions/:id/approve',
      adminAdmissionReject: 'PATCH /api/admin/admissions/:id/reject',
      adminAdmissionOfficeUse: 'PATCH /api/admin/admissions/:id/office-use',
      teacherApplicationsSubmit: 'POST /api/teacher-applications',
      teacherApplicationsMyApplication: 'GET /api/teacher-applications/my-application',
      adminTeacherApplications: 'GET /api/admin/teacher-applications',
      adminTeacherApplicationApprove: 'PATCH /api/admin/teacher-applications/:id/approve',
      adminTeacherApplicationReject: 'PATCH /api/admin/teacher-applications/:id/reject',
      stripeCheckout: 'POST /api/stripe/checkout',
      stripeWebhook: 'POST /api/stripe/webhook',
    },
  });
});

// Mount Main API Routes
app.use('/api', apiRoutes);

// 404 and Global Error Middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start Server locally if run directly and not in Vercel Serverless environment
if (!process.env.VERCEL && require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`[AIC Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`[AIC Server] Base URL: http://localhost:${PORT}`);
  });

  // Graceful Shutdown handling
  process.on('SIGTERM', () => {
    console.log('[AIC Server] SIGTERM signal received: closing HTTP server...');
    server.close(() => {
      console.log('[AIC Server] HTTP server closed.');
    });
  });

  process.on('SIGINT', () => {
    console.log('[AIC Server] SIGINT signal received: closing HTTP server...');
    server.close(() => {
      console.log('[AIC Server] HTTP server closed.');
      process.exit(0);
    });
  });
}

module.exports = app;
