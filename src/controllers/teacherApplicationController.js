const TeacherApplication = require('../models/TeacherApplication');
const User = require('../models/User');
const generateNextMemberId = require('../utils/generateMemberId');
const { sanitizeUser } = require('./authController');

/**
 * Helper to validate email format
 */
const isValidEmail = (email) => {
  return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(String(email).trim());
};

/**
 * @desc    Submit Teacher Employment Application
 * @route   POST /api/teacher-applications
 * @access  Private (Authenticated Teacher)
 */
const submitTeacherApplication = async (req, res, next) => {
  try {
    const teacherUser = req.user;
    if (!teacherUser || !teacherUser._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to submit teacher employment application.',
      });
    }

    // Role check: Only registered teachers can submit teacher applications
    if (teacherUser.role !== 'teacher') {
      return res.status(403).json({
        success: false,
        message: `Access denied. Only registered teachers can submit a Teacher Employment Application. Current role: '${teacherUser.role}'.`,
      });
    }

    // Check for existing active application (pending or approved)
    const existingActiveApplication = await TeacherApplication.findOne({
      teacher: teacherUser._id,
      status: { $in: ['pending', 'approved'] },
    }).sort({ createdAt: -1 });

    if (existingActiveApplication) {
      if (existingActiveApplication.status === 'pending') {
        return res.status(400).json({
          success: false,
          message:
            'You already have a teacher employment application pending review. Please wait for an administrator to review it.',
          applicationId: existingActiveApplication._id,
          status: existingActiveApplication.status,
          submittedAt: existingActiveApplication.submittedAt,
        });
      }

      if (existingActiveApplication.status === 'approved') {
        return res.status(400).json({
          success: false,
          message:
            'You already have an approved teacher application on file with Al Hidayah Islamic Center.',
          applicationId: existingActiveApplication._id,
          teacherId: existingActiveApplication.teacherId || teacherUser.memberId,
          status: existingActiveApplication.status,
        });
      }
    }

    const {
      // 1. Personal Information
      applicationDate,
      position,
      fullName,
      fatherOrSpouseName,
      address,
      phone,
      email,
      dateOfBirth,
      citizenship,
      emergencyContact,

      // 2. Education & Islamic Qualifications
      educationQualifications,
      quranTajweedHifzQualifications,
      ijazahOrCertification,

      // 3. Teaching Experience
      teachingExperience,

      // 4. Skills & Availability
      subjects,
      otherSubject,
      levels,
      languages,
      otherLanguage,
      employmentType,
      availability,
      startDate,

      // 5. References
      references,

      // 6. Applicant Declaration
      applicantAgreement,
      signature,
      signatureDate,
    } = req.body;

    // Validate Required Personal Information
    if (!position || !String(position).trim()) {
      return res.status(400).json({ success: false, message: 'Position applied for is required.' });
    }
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }
    if (!address || !String(address).trim()) {
      return res.status(400).json({ success: false, message: 'Residential address is required.' });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if (!dateOfBirth) {
      return res.status(400).json({ success: false, message: 'Date of birth is required.' });
    }
    if (!citizenship || !String(citizenship).trim()) {
      return res.status(400).json({ success: false, message: 'Citizenship status is required.' });
    }

    // Validate Emergency Contact
    if (!emergencyContact || !emergencyContact.name || !String(emergencyContact.name).trim()) {
      return res.status(400).json({ success: false, message: 'Emergency contact name is required.' });
    }
    if (!emergencyContact.phone || !String(emergencyContact.phone).trim()) {
      return res.status(400).json({ success: false, message: 'Emergency contact phone number is required.' });
    }

    // Validate Skills & Availability
    const parsedSubjects = Array.isArray(subjects)
      ? subjects.map((s) => String(s).trim()).filter(Boolean)
      : subjects
      ? [String(subjects).trim()]
      : [];

    if (parsedSubjects.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one subject must be selected.' });
    }

    const validEmploymentTypes = ['Full-time', 'Part-time', 'Weekend', 'Substitute'];
    if (!employmentType || !validEmploymentTypes.includes(String(employmentType).trim())) {
      return res.status(400).json({
        success: false,
        message: `Valid employment type (${validEmploymentTypes.join(', ')}) is required.`,
      });
    }

    // Validate Declaration & Signature
    if (!applicantAgreement || (applicantAgreement !== true && applicantAgreement !== 'true')) {
      return res.status(400).json({
        success: false,
        message: 'You must confirm and agree to the applicant declaration.',
      });
    }
    if (!signature || !String(signature).trim()) {
      return res.status(400).json({ success: false, message: 'Electronic signature is required.' });
    }

    // Sanitize arrays of subdocuments
    const parsedEducation = Array.isArray(educationQualifications)
      ? educationQualifications.map((item) => ({
          degreeCertificate: item?.degreeCertificate ? String(item.degreeCertificate).trim() : '',
          institution: item?.institution ? String(item.institution).trim() : '',
          subject: item?.subject ? String(item.subject).trim() : '',
          year: item?.year ? String(item.year).trim() : '',
        }))
      : [];

    const parsedExperience = Array.isArray(teachingExperience)
      ? teachingExperience.map((item) => ({
          institution: item?.institution ? String(item.institution).trim() : '',
          position: item?.position ? String(item.position).trim() : '',
          subjectOrClass: item?.subjectOrClass ? String(item.subjectOrClass).trim() : '',
          dates: item?.dates ? String(item.dates).trim() : '',
        }))
      : [];

    const parsedReferences = Array.isArray(references)
      ? references.map((item) => ({
          name: item?.name ? String(item.name).trim() : '',
          relation: item?.relation ? String(item.relation).trim() : '',
          organization: item?.organization ? String(item.organization).trim() : '',
          phone: item?.phone ? String(item.phone).trim() : '',
        }))
      : [];

    const parsedLevels = Array.isArray(levels)
      ? levels.map((l) => String(l).trim()).filter(Boolean)
      : levels
      ? [String(levels).trim()]
      : [];

    const parsedLanguages = Array.isArray(languages)
      ? languages.map((l) => String(l).trim()).filter(Boolean)
      : languages
      ? [String(languages).trim()]
      : [];

    const parsedAvailability = {
      days: Array.isArray(availability?.days)
        ? availability.days.map((d) => String(d).trim()).filter(Boolean)
        : availability?.days
        ? [String(availability.days).trim()]
        : [],
      time: availability?.time ? String(availability.time).trim() : '',
    };

    // Construct fresh teacher application document, stripping any client-tampered admin fields
    const newApplication = new TeacherApplication({
      teacher: teacherUser._id,
      teacherName: teacherUser.name || String(fullName).trim(),
      teacherEmail: teacherUser.email || String(email).trim().toLowerCase(),

      // Personal Information
      applicationDate: applicationDate ? new Date(applicationDate) : new Date(),
      position: String(position).trim(),
      fullName: String(fullName).trim(),
      fatherOrSpouseName: fatherOrSpouseName ? String(fatherOrSpouseName).trim() : '',
      address: String(address).trim(),
      phone: String(phone).trim(),
      email: String(email).trim().toLowerCase(),
      dateOfBirth: new Date(dateOfBirth),
      citizenship: String(citizenship).trim(),
      emergencyContact: {
        name: String(emergencyContact.name).trim(),
        phone: String(emergencyContact.phone).trim(),
      },

      // Education & Qualifications
      educationQualifications: parsedEducation,
      quranTajweedHifzQualifications: quranTajweedHifzQualifications
        ? String(quranTajweedHifzQualifications).trim()
        : '',
      ijazahOrCertification: ijazahOrCertification ? String(ijazahOrCertification).trim() : '',

      // Teaching Experience
      teachingExperience: parsedExperience,

      // Skills & Availability
      subjects: parsedSubjects,
      otherSubject: otherSubject ? String(otherSubject).trim() : '',
      levels: parsedLevels,
      languages: parsedLanguages,
      otherLanguage: otherLanguage ? String(otherLanguage).trim() : '',
      employmentType: String(employmentType).trim(),
      availability: parsedAvailability,
      startDate: startDate ? new Date(startDate) : undefined,

      // References
      references: parsedReferences,

      // Declaration & Signature
      applicantAgreement: true,
      signature: String(signature).trim(),
      signatureDate: signatureDate ? new Date(signatureDate) : new Date(),
      submittedAt: new Date(),

      // Status
      status: 'pending',
    });

    await newApplication.save();

    // Sync user details if needed and reset rejected status to pending
    try {
      const user = await User.findById(teacherUser._id);
      if (user) {
        if (!user.phone) user.phone = String(phone).trim();
        if (!user.address) user.address = String(address).trim();
        if (!user.dateOfBirth && dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
        if (user.status === 'rejected') {
          user.status = 'pending';
          user.rejectionReason = undefined;
        }
        await user.save();
      }
    } catch (syncErr) {
      console.warn('[Teacher Application Profile Sync Warning]:', syncErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Teacher application submitted successfully. It is now pending review by administration.',
      application: newApplication,
    });
  } catch (error) {
    console.error('[Submit Teacher Application Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get Current Teacher's own Application & Status
 * @route   GET /api/teacher-applications/my-application or GET /api/teacher-applications/me
 * @access  Private (Authenticated Teacher)
 */
const getMyTeacherApplication = async (req, res, next) => {
  try {
    const teacherUser = req.user;
    if (!teacherUser || !teacherUser._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view your application.',
      });
    }

    if (teacherUser.role !== 'teacher' && teacherUser.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only teachers can view teacher applications.',
      });
    }

    const application = await TeacherApplication.findOne({ teacher: teacherUser._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!application) {
      return res.status(200).json({
        success: true,
        hasApplication: false,
        message: 'No teacher application found for this account.',
        application: null,
      });
    }

    return res.status(200).json({
      success: true,
      hasApplication: true,
      application,
    });
  } catch (error) {
    console.error('[GetMyTeacherApplication Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get Teacher Application Details by ID
 * @route   GET /api/teacher-applications/:id or GET /api/admin/teacher-applications/:id
 * @access  Private (Admin or the Owner Teacher)
 */
const getTeacherApplicationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await TeacherApplication.findById(id).populate(
      'teacher',
      'name email role memberId status isVerified phone'
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Teacher application not found.',
      });
    }

    const isAdmin =
      req.user &&
      (req.user.role === 'admin' ||
        req.user.id === 'admin_master' ||
        req.user._id === 'admin_master');

    const isOwner =
      req.user &&
      application.teacher &&
      (application.teacher._id.toString() === req.user._id?.toString() ||
        application.teacher.toString() === req.user._id?.toString());

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own teacher application.',
      });
    }

    return res.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('[GetTeacherApplicationById Error]:', error);
    next(error);
  }
};

/**
 * @desc    List all Teacher Applications with filters & pagination (Admin only)
 * @route   GET /api/admin/teacher-applications
 * @access  Private (Admin Auth required)
 */
const getAdminTeacherApplications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const statusFilter = req.query.status; // 'pending' | 'approved' | 'rejected' | 'all'
    const positionFilter = req.query.position;
    const searchQuery = req.query.search ? req.query.search.trim() : '';

    const filter = {};

    if (statusFilter && statusFilter !== 'all') {
      filter.status = statusFilter;
    }

    if (positionFilter && positionFilter !== 'all') {
      filter.position = { $regex: positionFilter, $options: 'i' };
    }

    if (searchQuery) {
      filter.$or = [
        { fullName: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
        { phone: { $regex: searchQuery, $options: 'i' } },
        { teacherId: { $regex: searchQuery, $options: 'i' } },
        { position: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    const [applications, totalCount, countsResult] = await Promise.all([
      TeacherApplication.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('teacher', 'name email memberId status isVerified')
        .lean(),
      TeacherApplication.countDocuments(filter),
      TeacherApplication.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const counts = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };

    countsResult.forEach((item) => {
      counts.total += item.count;
      if (item._id === 'pending') counts.pending = item.count;
      if (item._id === 'approved') counts.approved = item.count;
      if (item._id === 'rejected') counts.rejected = item.count;
    });

    return res.status(200).json({
      success: true,
      counts,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
      applications,
    });
  } catch (error) {
    console.error('[GetAdminTeacherApplications Error]:', error);
    next(error);
  }
};

/**
 * @desc    Approve Teacher Application (Admin only)
 * @route   PATCH /api/admin/teacher-applications/:id/approve or POST /api/admin/teacher-applications/:id/approve
 * @access  Private (Admin Auth required)
 */
const approveTeacherApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    const application = await TeacherApplication.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Teacher application not found.',
      });
    }

    // Determine unique Teacher ID:
    // Priority: 1. application existing teacherId, 2. teacher User existing memberId (if AIC-TEA), 3. atomically generated
    let assignedTeacherId = application.teacherId;

    if (!assignedTeacherId) {
      const teacherUser = await User.findById(application.teacher);
      if (teacherUser && teacherUser.memberId && teacherUser.memberId.startsWith('AIC-TEA')) {
        assignedTeacherId = teacherUser.memberId;
      } else {
        assignedTeacherId = await generateNextMemberId('teacher');
      }
    }

    // Update Application Status & Approval details
    application.status = 'approved';
    application.teacherId = assignedTeacherId;
    application.rejectionReason = '';
    application.reviewedAt = new Date();
    application.reviewedBy = req.user?._id !== 'admin_master' ? req.user?._id : undefined;
    application.reviewedByName = req.user?.name || 'Administrator';

    await application.save();

    // Synchronize the related User account
    let updatedUser = null;
    try {
      const user = await User.findById(application.teacher);
      if (user) {
        user.status = 'approved';
        user.isVerified = true;
        user.memberId = assignedTeacherId;
        user.role = 'teacher';
        user.approvedAt = new Date();
        user.approvedBy = req.user?._id !== 'admin_master' ? req.user?._id : undefined;
        user.rejectionReason = undefined;
        await user.save();
        updatedUser = sanitizeUser(user);
      }
    } catch (userErr) {
      console.error('[Teacher User Approval Sync Error]:', userErr);
    }

    console.log(
      `[Teacher Approved] Application ${application._id} approved for ${application.fullName}. Assigned Teacher ID: ${assignedTeacherId}`
    );

    return res.status(200).json({
      success: true,
      message: `Teacher application approved successfully. Assigned Teacher ID: ${assignedTeacherId}`,
      application,
      teacher: updatedUser,
    });
  } catch (error) {
    console.error('[ApproveTeacherApplication Error]:', error);
    next(error);
  }
};

/**
 * @desc    Reject Teacher Application (Admin only)
 * @route   PATCH /api/admin/teacher-applications/:id/reject or POST /api/admin/teacher-applications/:id/reject
 * @access  Private (Admin Auth required)
 */
const rejectTeacherApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, rejectionReason } = req.body;

    const finalReason = String(reason || rejectionReason || 'Teacher application was declined by the administration.').trim();

    const application = await TeacherApplication.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Teacher application not found.',
      });
    }

    // Update Application Status & Rejection details
    application.status = 'rejected';
    application.rejectionReason = finalReason;
    application.reviewedAt = new Date();
    application.reviewedBy = req.user?._id !== 'admin_master' ? req.user?._id : undefined;
    application.reviewedByName = req.user?.name || 'Administrator';

    await application.save();

    // Synchronize the related User account status to rejected
    let updatedUser = null;
    try {
      const user = await User.findById(application.teacher);
      if (user) {
        user.status = 'rejected';
        user.rejectionReason = finalReason;
        await user.save();
        updatedUser = sanitizeUser(user);
      }
    } catch (userErr) {
      console.error('[Teacher User Rejection Sync Error]:', userErr);
    }

    console.log(`[Teacher Rejected] Application ${application._id} rejected for ${application.fullName}`);

    return res.status(200).json({
      success: true,
      message: 'Teacher application has been rejected.',
      application,
      teacher: updatedUser,
    });
  } catch (error) {
    console.error('[RejectTeacherApplication Error]:', error);
    next(error);
  }
};

module.exports = {
  submitTeacherApplication,
  getMyTeacherApplication,
  getTeacherApplicationById,
  getAdminTeacherApplications,
  approveTeacherApplication,
  rejectTeacherApplication,
};
