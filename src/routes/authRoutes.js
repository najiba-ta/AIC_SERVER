const express = require('express');
const { register, login, getMe, updateProfile, logout, submitAdmission, getAdmission } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Public auth endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Protected user self endpoints
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.patch('/profile', protect, updateProfile);

// Student Admission endpoints
router.post('/admission', protect, submitAdmission);
router.get('/admission', protect, getAdmission);

module.exports = router;
