const mongoose = require('mongoose');

const processedEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 30, // Auto-expire after 30 days via TTL index
    },
  },
  {
    timestamps: false,
  }
);

const ProcessedEvent = mongoose.model('ProcessedEvent', processedEventSchema);

module.exports = ProcessedEvent;
