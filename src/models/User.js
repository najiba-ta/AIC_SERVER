const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Do not return password by default in queries
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin', 'user'],
      default: 'student',
      index: true,
    },
    memberId: {
      type: String,
      trim: true,
      uppercase: true,
      index: {
        unique: true,
        sparse: true,
      },
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      default: '',
    },
    profilePicture: {
      type: String,
      default: '',
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [500, 'Bio cannot exceed 500 characters'],
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'boy', 'girl', 'other', ''],
      default: '',
    },
    dateOfBirth: {
      type: Date,
    },
    address: {
      type: String,
      trim: true,
    },
    // Teacher specific fields
    subject: {
      type: String,
      trim: true,
    },
    qualification: {
      type: String,
      trim: true,
    },
    // Student specific fields
    guardianName: {
      type: String,
      trim: true,
    },
    guardianPhone: {
      type: String,
      trim: true,
    },
    classLevel: {
      type: String,
      trim: true,
    },
    // Approval details
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Student Admission Application Data
    admissionForm: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    admissionStatus: {
      type: String,
      enum: ['not_submitted', 'pending', 'approved', 'rejected'],
      default: 'not_submitted',
      index: true,
    },
    admissionSubmittedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Helpful compound index for listing pending applications
userSchema.index({ role: 1, status: 1, createdAt: -1 });

// Hash password before saving if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare entered password with hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
