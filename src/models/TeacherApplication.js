const mongoose = require('mongoose');

const educationQualificationSchema = new mongoose.Schema(
  {
    degreeCertificate: { type: String, trim: true, default: '' },
    institution: { type: String, trim: true, default: '' },
    subject: { type: String, trim: true, default: '' },
    year: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const teachingExperienceSchema = new mongoose.Schema(
  {
    institution: { type: String, trim: true, default: '' },
    position: { type: String, trim: true, default: '' },
    subjectOrClass: { type: String, trim: true, default: '' },
    dates: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const referenceSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    relation: { type: String, trim: true, default: '' },
    organization: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: [true, 'Emergency contact name is required'] },
    phone: { type: String, trim: true, required: [true, 'Emergency contact phone is required'] },
  },
  { _id: false }
);

const availabilitySchema = new mongoose.Schema(
  {
    days: {
      type: mongoose.Schema.Types.Mixed,
      default: [],
    },
    time: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const teacherApplicationSchema = new mongoose.Schema(
  {
    // Reference to authenticated Teacher User account
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Teacher user reference is required'],
      index: true,
    },
    teacherName: {
      type: String,
      trim: true,
    },
    teacherEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },

    // 1. Personal Information
    applicationDate: {
      type: Date,
      default: Date.now,
    },
    position: {
      type: String,
      required: [true, 'Applied position is required'],
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [120, 'Full name cannot exceed 120 characters'],
    },
    fatherOrSpouseName: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      required: [true, 'Residential address is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Date of birth is required'],
    },
    citizenship: {
      type: String,
      required: [true, 'Citizenship is required'],
      trim: true,
    },
    emergencyContact: {
      type: emergencyContactSchema,
      required: [true, 'Emergency contact information is required'],
    },

    // 2. Education & Islamic Qualifications
    educationQualifications: {
      type: [educationQualificationSchema],
      default: [],
    },
    quranTajweedHifzQualifications: {
      type: String,
      trim: true,
      default: '',
    },
    ijazahOrCertification: {
      type: String,
      trim: true,
      default: '',
    },

    // 3. Teaching Experience
    teachingExperience: {
      type: [teachingExperienceSchema],
      default: [],
    },

    // 4. Skills & Availability
    subjects: {
      type: [String],
      required: [true, 'At least one subject is required'],
      default: [],
    },
    otherSubject: {
      type: String,
      trim: true,
      default: '',
    },
    levels: {
      type: [String],
      default: [],
    },
    languages: {
      type: [String],
      default: [],
    },
    otherLanguage: {
      type: String,
      trim: true,
      default: '',
    },
    employmentType: {
      type: String,
      required: [true, 'Employment type is required'],
      enum: {
        values: ['Full-time', 'Part-time', 'Weekend', 'Substitute'],
        message: 'Employment type must be Full-time, Part-time, Weekend, or Substitute',
      },
      trim: true,
    },
    availability: {
      type: availabilitySchema,
      default: () => ({ days: [], time: '' }),
    },
    startDate: {
      type: Date,
    },

    // 5. References
    references: {
      type: [referenceSchema],
      default: [],
    },

    // 6. Applicant Declaration
    applicantAgreement: {
      type: Boolean,
      required: [true, 'Applicant declaration agreement is mandatory'],
      default: false,
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

    // 7. Status & Tracking
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true,
    },
    teacherId: {
      type: String,
      trim: true,
      uppercase: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedByName: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedAt: {
      type: Date,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// High-performance compound indexes
teacherApplicationSchema.index({ status: 1, createdAt: -1 });
teacherApplicationSchema.index({ teacher: 1, status: 1 });
teacherApplicationSchema.index({ teacherId: 1 }, { sparse: true });

const TeacherApplication = mongoose.model('TeacherApplication', teacherApplicationSchema);

module.exports = TeacherApplication;
