const express = require('express');
const stripeRoutes = require('./stripeRoutes');
const adminRoutes = require('./adminRoutes');
const authRoutes = require('./authRoutes');
const admissionRoutes = require('./admissionRoutes');
const teacherApplicationRoutes = require('./teacherApplicationRoutes');

const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Al Hidayah Islamic Center API is active and healthy',
    timestamp: new Date().toISOString(),
  });
});

// Mount modular sub-routes
router.use('/auth', authRoutes);
router.use('/admissions', admissionRoutes);
router.use('/teacher-applications', teacherApplicationRoutes);
router.use('/stripe', stripeRoutes);
router.use('/admin', adminRoutes);

module.exports = router;

