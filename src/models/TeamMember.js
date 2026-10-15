const mongoose = require('mongoose');

const teamMemberSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters'],
      maxlength: [120, 'Full name cannot exceed 120 characters'],
    },
    designation: {
      type: String,
      required: [true, 'Designation / role is required'],
      trim: true,
      minlength: [2, 'Designation must be at least 2 characters'],
      maxlength: [120, 'Designation cannot exceed 120 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['Leadership', 'Teacher', 'Administration'],
        message: 'Category must be Leadership, Teacher, or Administration',
      },
      trim: true,
      index: true,
    },
    qualifications: {
      type: mongoose.Schema.Types.Mixed,
      default: '',
    },
    department: {
      type: String,
      trim: true,
      maxlength: [100, 'Department cannot exceed 100 characters'],
      default: '',
    },
    subject: {
      type: String,
      trim: true,
      maxlength: [100, 'Subject cannot exceed 100 characters'],
      default: '',
    },
    biography: {
      type: String,
      trim: true,
      maxlength: [3000, 'Biography cannot exceed 3000 characters'],
      default: '',
    },
    profileImage: {
      type: String,
      trim: true,
      maxlength: [1024, 'Profile image URL cannot exceed 1024 characters'],
      default: '',
      validate: {
        validator: function (v) {
          if (!v) return true;
          // Disallow large base64 payloads to protect MongoDB document limits
          if (v.startsWith('data:') && v.length > 512) {
            return false;
          }
          return true;
        },
        message: 'Profile image must be a valid image URL or reference (embedded base64 data URIs are not permitted).',
      },
    },
    responsibilities: {
      type: String,
      trim: true,
      maxlength: [2000, 'Responsibilities cannot exceed 2000 characters'],
      default: '',
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// High-performance compound indexes for category filtering and display ordering
teamMemberSchema.index({ isPublished: 1, displayOrder: 1, createdAt: 1 });
teamMemberSchema.index({ category: 1, isPublished: 1, displayOrder: 1 });

const TeamMember = mongoose.model('TeamMember', teamMemberSchema);

module.exports = TeamMember;
