const express = require('express');
const {
  submitTeacherApplication,
  getMyTeacherApplication,
  getTeacherApplicationById,
} = require('../controllers/teacherApplicationController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// All teacher application submission and personal retrieval routes require authenticated session
router.use(protect);

// Teacher submit employment application
router.post('/', submitTeacherApplication);

// Teacher retrieve own application & status
router.get('/my-application', getMyTeacherApplication);
router.get('/me', getMyTeacherApplication);

// Retrieve application by ID (Owner teacher or Admin)
router.get('/:id', getTeacherApplicationById);

module.exports = router;
