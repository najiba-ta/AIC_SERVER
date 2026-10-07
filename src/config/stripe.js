const Stripe = require('stripe');
const dotenv = require('dotenv');

dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder_key';

if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder_key') {
  console.warn('[Stripe] Notice: STRIPE_SECRET_KEY is using a placeholder. Please configure your Stripe Test Secret Key in .env.');
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-12-18.acacia',
  appInfo: {
    name: 'Al Hidayah Islamic Center Backend',
    version: '1.0.0',
  },
});

module.exports = stripe;
