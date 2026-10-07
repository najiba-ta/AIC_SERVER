const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema(
  {
    // Reference to authenticated Student User account
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student user reference is required'],
      index: true,
    },
    studentName: {
      type: String,
      trim: true,
    },
    studentEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // 1. Student Personal Information
    fullName: {
      type: String,
      required: [true, 'Student full name is required'],
      trim: true,
      maxlength: [120, 'Full name cannot exceed 120 characters'],
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    gender: {
      type: String,
      required: [true, 'Gender is required'],
      enum: {
        values: ['male', 'female', 'other'],
        message: 'Gender must be male, female, or other',
      },
      lowercase: true,
      trim: true,
    },
    bloodGroup: {
      type: String,
      trim: true,
      uppercase: true,
    },
    phone: {
      type: String,
      required: [true, 'Student/contact phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Student email is required'],
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      required: [true, 'Residential address is required'],
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    zipCode: {
      type: String,
      trim: true,
    },
    country: {
      type: String,
      trim: true,
      default: 'United States',
    },
    schoolOrCollege: {
      type: String,
      trim: true,
    },
    currentGrade: {
      type: String,
      trim: true,
    },

    // 2. Parent / Guardian Information
    guardianName: {
      type: String,
      required: [true, 'Parent/Guardian name is required'],
      trim: true,
    },
    relationship: {
      type: String,
      required: [true, 'Relationship to student is required'],
      trim: true,
    },
    guardianPhone: {
      type: String,
      required: [true, 'Parent/Guardian phone number is required'],
      trim: true,
    },
    guardianEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    guardianOccupation: {
      type: String,
      trim: true,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      relationship: { type: String, trim: true },
      phone: { type: String, trim: true },
    },

    // 3. Program Selection & Class Type
    program: {
      type: String,
      required: [true, 'Program selection is required'],
      trim: true,
    },
    classType: {
      type: String,
      required: [true, 'Class type (e.g., Online, In-Person, Weekend, Weekday) is required'],
      trim: true,
    },
    quranLevel: {
      type: String,
      required: [true, 'Qur’an learning level is required'],
      trim: true,
    },

    // 4. Schedule Preferences
    preferredDays: {
      type: [String],
      default: [],
    },
    preferredTimeSlot: {
      type: String,
      trim: true,
    },
    schedulePreferences: {
      type: String,
      trim: true,
    },

    // 5. Previous Learning Experience
    previousExperience: {
      type: String,
      trim: true,
    },
    previousInstitute: {
      type: String,
      trim: true,
    },
    previousTeacher: {
      type: String,
      trim: true,
    },
    yearsOfStudy: {
      type: String,
      trim: true,
    },

    // 6. Learning Needs & Notes
    learningNeeds: {
      type: String,
      trim: true,
    },
    additionalNotes: {
      type: String,
      trim: true,
    },

    // 7. Parent/Guardian Agreement & Signature
    guardianAgreement: {
      type: Boolean,
      required: [true, 'Parent/Guardian agreement is required'],
      default: false,
    },
    agreementText: {
      type: String,
      trim: true,
    },
    signature: {
      type: String,
      required: [true, 'Signature is required'],
      trim: true,
    },
    signatureDate: {
      type: Date,
      default: Date.now,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // 8. Application Status
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedByName: {
      type: String,
      trim: true,
    },
    reviewedAt: {
      type: Date,
    },

    // 9. Admin Office-Use Fields
    officeUse: {
      registrationDate: {
        type: Date,
      },
      assignedTeacher: {
        type: String,
        trim: true,
      },
      monthlyFee: {
        type: Number,
        min: [0, 'Monthly fee cannot be negative'],
      },
      studentId: {
        type: String,
        trim: true,
        uppercase: true,
      },
      classLevel: {
        type: String,
        trim: true,
      },
      startDate: {
        type: Date,
      },
      officeNotes: {
        type: String,
        trim: true,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for high performance administrative filtering
admissionSchema.index({ status: 1, createdAt: -1 });
admissionSchema.index({ student: 1, status: 1 });
admissionSchema.index({ 'officeUse.studentId': 1 }, { sparse: true });

const Admission = mongoose.model('Admission', admissionSchema);

module.exports = Admission;
