const express = require('express');
const { createCheckoutSession, handleWebhook } = require('../controllers/stripeController');

const router = express.Router();

// Stripe Checkout Session Creation
router.post('/checkout', express.json(), createCheckoutSession);

// Stripe Webhook (Raw body required for Stripe cryptographic signature verification)
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
