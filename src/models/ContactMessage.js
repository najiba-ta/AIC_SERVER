const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Sender name is required'],
      trim: true,
      maxlength: [100, 'Sender name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Sender email address is required'],
      trim: true,
      lowercase: true,
      maxlength: [150, 'Email address cannot exceed 150 characters'],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address',
      ],
    },
    subject: {
      type: String,
      required: [true, 'Subject is required'],
      trim: true,
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    isDelivered: {
      type: Boolean,
      default: false,
      index: true,
    },
    deliveredAt: {
      type: Date,
    },
    deliveryError: {
      type: String,
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for query performance and sorting
contactMessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactMessage', contactMessageSchema);
