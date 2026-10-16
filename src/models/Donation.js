const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema(
  {
    stripeSessionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
      index: true,
    },
    livemode: {
      type: Boolean,
      default: false,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Donation amount in USD is required'],
      min: [1, 'Minimum donation amount is $1.00 USD'],
    },
    amountInCents: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'usd',
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    paymentStatus: {
      type: String,
      default: 'unpaid',
    },
    donorName: {
      type: String,
      trim: true,
      default: 'Anonymous',
    },
    donorEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    donorPhone: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'General Donation',
    },
    message: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    stripeReceiptUrl: {
      type: String,
    },
    paidAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful indexes for sorting donations and calculating live aggregates
donationSchema.index({ status: 1, createdAt: -1 });
donationSchema.index({ status: 1, livemode: 1, createdAt: -1 });
donationSchema.index({ livemode: 1, createdAt: -1 });

const Donation = mongoose.model('Donation', donationSchema);

module.exports = Donation;
