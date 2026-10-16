const express = require('express');
const {
  submitContactMessage,
  getContactMessages,
  getContactMessageById,
} = require('../controllers/contactController');
const { requireAdminAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Public contact form submission - accessible to all visitors
router.post('/', submitContactMessage);

// Admin-only contact message audit trails
router.get('/messages', requireAdminAuth, getContactMessages);
router.get('/messages/:id', requireAdminAuth, getContactMessageById);

module.exports = router;
