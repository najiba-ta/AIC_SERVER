const express = require('express');
const {
  submitAdmission,
  getMyAdmission,
  getAdmissionById,
} = require('../controllers/admissionController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All admission submission and status routes require authentication
router.use(protect);

// Student submit admission form
router.post('/', submitAdmission);

// Student retrieve own application & status
router.get('/my-application', getMyAdmission);
router.get('/me', getMyAdmission);

// Retrieve application by ID (Owner student or Admin)
router.get('/:id', getAdmissionById);

module.exports = router;
