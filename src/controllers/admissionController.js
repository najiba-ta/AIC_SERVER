const Admission = require('../models/Admission');
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
 * @desc    Submit Student Admission Application
 * @route   POST /api/admissions
 * @access  Private (Authenticated Student/User)
 */
const submitAdmission = async (req, res, next) => {
  try {
    const studentUser = req.user;
    if (!studentUser || !studentUser._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to submit an admission form.',
      });
    }

    // Check if the student already has an active (pending or approved) admission application
    const existingActiveApplication = await Admission.findOne({
      student: studentUser._id,
      status: { $in: ['pending', 'approved'] },
    }).sort({ createdAt: -1 });

    if (existingActiveApplication) {
      if (existingActiveApplication.status === 'pending') {
        return res.status(400).json({
          success: false,
          message:
            'You already have an admission application pending review. Please wait for an administrator to review it.',
          applicationId: existingActiveApplication._id,
          status: existingActiveApplication.status,
          submittedAt: existingActiveApplication.submittedAt,
        });
      }

      if (existingActiveApplication.status === 'approved') {
        return res.status(400).json({
          success: false,
          message:
            'You have already been admitted to Al Hidayah Islamic Center with an approved application.',
          applicationId: existingActiveApplication._id,
          studentId: existingActiveApplication.officeUse?.studentId || studentUser.memberId,
          status: existingActiveApplication.status,
        });
      }
    }

    const {
      // 1. Student Personal Details
      fullName,
      dateOfBirth,
      gender,
      bloodGroup,
      phone,
      email,
      address,
      city,
      state,
      zipCode,
      country,
      schoolOrCollege,
      currentGrade,

      // 2. Parent / Guardian Details
      guardianName,
      relationship,
      guardianPhone,
      guardianEmail,
      guardianOccupation,
      emergencyContact,

      // 3. Program Selection & Placement
      program,
      classType,
      quranLevel,

      // 4. Schedule Preferences
      preferredDays,
      preferredTimeSlot,
      schedulePreferences,

      // 5. Previous Experience & Institution
      previousExperience,
      previousInstitute,
      previousTeacher,
      yearsOfStudy,

      // 6. Needs & Notes
      learningNeeds,
      additionalNotes,

      // 7. Agreement & Signature
      guardianAgreement,
      agreementText,
      signature,
      signatureDate,
    } = req.body;

    // Validate Required Student Information
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ success: false, message: 'Student full name is required.' });
    }
    if (!dateOfBirth) {
      return res.status(400).json({ success: false, message: 'Student date of birth is required.' });
    }
    if (!gender || !['male', 'female', 'other'].includes(String(gender).toLowerCase().trim())) {
      return res.status(400).json({
        success: false,
        message: 'Valid gender selection (male, female, or other) is required.',
      });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, message: 'Student contact phone number is required.' });
    }
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'A valid email address is required.' });
    }
    if (!address || !String(address).trim()) {
      return res.status(400).json({ success: false, message: 'Residential address is required.' });
    }

    // Validate Required Guardian Information
    if (!guardianName || !String(guardianName).trim()) {
      return res.status(400).json({ success: false, message: 'Parent or Guardian name is required.' });
    }
    if (!relationship || !String(relationship).trim()) {
      return res.status(400).json({ success: false, message: 'Relationship to student is required.' });
    }
    if (!guardianPhone || !String(guardianPhone).trim()) {
      return res.status(400).json({ success: false, message: 'Parent or Guardian phone number is required.' });
    }

    // Validate Program Selection
    if (!program || !String(program).trim()) {
      return res.status(400).json({ success: false, message: 'Program selection is required.' });
    }
    if (!classType || !String(classType).trim()) {
      return res.status(400).json({ success: false, message: 'Class type selection is required.' });
    }
    if (!quranLevel || !String(quranLevel).trim()) {
      return res.status(400).json({ success: false, message: 'Qur’an reading/learning level is required.' });
    }

    // Validate Parent/Guardian Agreement & Signature
    if (!guardianAgreement || guardianAgreement !== true && guardianAgreement !== 'true') {
      return res.status(400).json({
        success: false,
        message: 'You must read and agree to the Parent/Guardian terms and code of conduct.',
      });
    }
    if (!signature || !String(signature).trim()) {
      return res.status(400).json({ success: false, message: 'Electronic signature is required.' });
    }

    // Construct clean admission document (excluding any client-tampered admin fields)
    const newAdmission = new Admission({
      student: studentUser._id,
      studentName: studentUser.name || String(fullName).trim(),
      studentEmail: studentUser.email || String(email).trim().toLowerCase(),

      // Student Info
      fullName: String(fullName).trim(),
      dateOfBirth: new Date(dateOfBirth),
      gender: String(gender).toLowerCase().trim(),
      bloodGroup: bloodGroup ? String(bloodGroup).trim().toUpperCase() : '',
      phone: String(phone).trim(),
      email: String(email).trim().toLowerCase(),
      address: String(address).trim(),
      city: city ? String(city).trim() : '',
      state: state ? String(state).trim() : '',
      zipCode: zipCode ? String(zipCode).trim() : '',
      country: country ? String(country).trim() : 'United States',
      schoolOrCollege: schoolOrCollege ? String(schoolOrCollege).trim() : '',
      currentGrade: currentGrade ? String(currentGrade).trim() : '',

      // Guardian Info
      guardianName: String(guardianName).trim(),
      relationship: String(relationship).trim(),
      guardianPhone: String(guardianPhone).trim(),
      guardianEmail: guardianEmail ? String(guardianEmail).trim().toLowerCase() : '',
      guardianOccupation: guardianOccupation ? String(guardianOccupation).trim() : '',
      emergencyContact: {
        name: emergencyContact?.name ? String(emergencyContact.name).trim() : '',
        relationship: emergencyContact?.relationship ? String(emergencyContact.relationship).trim() : '',
        phone: emergencyContact?.phone ? String(emergencyContact.phone).trim() : '',
      },

      // Program Details
      program: String(program).trim(),
      classType: String(classType).trim(),
      quranLevel: String(quranLevel).trim(),

      // Schedule Preferences
      preferredDays: Array.isArray(preferredDays)
        ? preferredDays.map((d) => String(d).trim()).filter(Boolean)
        : preferredDays
        ? [String(preferredDays).trim()]
        : [],
      preferredTimeSlot: preferredTimeSlot ? String(preferredTimeSlot).trim() : '',
      schedulePreferences: schedulePreferences ? String(schedulePreferences).trim() : '',

      // Previous Learning Experience
      previousExperience: previousExperience ? String(previousExperience).trim() : '',
      previousInstitute: previousInstitute ? String(previousInstitute).trim() : '',
      previousTeacher: previousTeacher ? String(previousTeacher).trim() : '',
      yearsOfStudy: yearsOfStudy ? String(yearsOfStudy).trim() : '',

      // Notes
      learningNeeds: learningNeeds ? String(learningNeeds).trim() : '',
      additionalNotes: additionalNotes ? String(additionalNotes).trim() : '',

      // Agreement & Signature
      guardianAgreement: true,
      agreementText: agreementText ? String(agreementText).trim() : '',
      signature: String(signature).trim(),
      signatureDate: signatureDate ? new Date(signatureDate) : new Date(),
      submittedAt: new Date(),

      // Status
      status: 'pending',
    });

    await newAdmission.save();

    // Optionally update user's profile with provided contact info if not set
    try {
      const user = await User.findById(studentUser._id);
      if (user) {
        if (!user.phone) user.phone = String(phone).trim();
        if (!user.guardianName) user.guardianName = String(guardianName).trim();
        if (!user.guardianPhone) user.guardianPhone = String(guardianPhone).trim();
        if (!user.address) user.address = String(address).trim();
        if (!user.gender && gender) user.gender = String(gender).toLowerCase().trim();
        if (!user.dateOfBirth && dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
        await user.save();
      }
    } catch (profileErr) {
      console.warn('[Admission Profile Sync Warning]:', profileErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Admission application submitted successfully. It is now pending review by administration.',
      application: newAdmission,
    });
  } catch (error) {
    console.error('[Submit Admission Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get Current Student's own Admission Application & Status
 * @route   GET /api/admissions/my-application or GET /api/admissions/me
 * @access  Private (Authenticated Student)
 */
const getMyAdmission = async (req, res, next) => {
  try {
    const studentUser = req.user;
    if (!studentUser || !studentUser._id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view your application.',
      });
    }

    // Fetch the latest application for this student
    const application = await Admission.findOne({ student: studentUser._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!application) {
      return res.status(200).json({
        success: true,
        hasApplication: false,
        message: 'No admission application found for this account.',
        application: null,
      });
    }

    return res.status(200).json({
      success: true,
      hasApplication: true,
      application,
    });
  } catch (error) {
    console.error('[GetMyAdmission Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get Admission Application Details by ID
 * @route   GET /api/admissions/:id or GET /api/admin/admissions/:id
 * @access  Private (Admin or the Owner Student)
 */
const getAdmissionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const application = await Admission.findById(id).populate(
      'student',
      'name email role memberId status isVerified phone'
    );

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Admission application not found.',
      });
    }

    const isAdmin =
      req.user &&
      (req.user.role === 'admin' ||
        req.user.id === 'admin_master' ||
        req.user._id === 'admin_master');

    const isOwner =
      req.user &&
      application.student &&
      (application.student._id.toString() === req.user._id?.toString() ||
        application.student.toString() === req.user._id?.toString());

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only view your own admission application.',
      });
    }

    return res.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('[GetAdmissionById Error]:', error);
    next(error);
  }
};

/**
 * @desc    List all Admission Applications with filters & pagination (Admin only)
 * @route   GET /api/admin/admissions
 * @access  Private (Admin Auth required)
 */
const getAdminAdmissions = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const statusFilter = req.query.status; // 'pending' | 'approved' | 'rejected' | 'all'
    const programFilter = req.query.program;
    const classTypeFilter = req.query.classType;
    const searchQuery = req.query.search ? req.query.search.trim() : '';

    const filter = {};

    if (statusFilter && statusFilter !== 'all') {
      filter.status = statusFilter;
    }

    if (programFilter && programFilter !== 'all') {
      filter.program = { $regex: programFilter, $options: 'i' };
    }

    if (classTypeFilter && classTypeFilter !== 'all') {
      filter.classType = { $regex: classTypeFilter, $options: 'i' };
    }

    if (searchQuery) {
      filter.$or = [
        { fullName: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
        { phone: { $regex: searchQuery, $options: 'i' } },
        { guardianName: { $regex: searchQuery, $options: 'i' } },
        { 'officeUse.studentId': { $regex: searchQuery, $options: 'i' } },
        { program: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    const [applications, totalCount, countsResult] = await Promise.all([
      Admission.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('student', 'name email memberId status isVerified')
        .lean(),
      Admission.countDocuments(filter),
      Admission.aggregate([
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
    console.error('[GetAdminAdmissions Error]:', error);
    next(error);
  }
};

/**
 * @desc    Approve Student Admission Application (Admin only)
 * @route   PATCH /api/admin/admissions/:id/approve or POST /api/admin/admissions/:id/approve
 * @access  Private (Admin Auth required)
 */
const approveAdmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      registrationDate,
      assignedTeacher,
      monthlyFee,
      studentId: providedStudentId,
      classLevel,
      startDate,
      officeNotes,
    } = req.body;

    const application = await Admission.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Admission application not found.',
      });
    }

    // Determine unique Student ID:
    // Priority: 1. providedStudentId, 2. application existing studentId, 3. user existing memberId, 4. atomically generated ID
    let assignedStudentId = providedStudentId
      ? String(providedStudentId).trim().toUpperCase()
      : application.officeUse?.studentId;

    if (!assignedStudentId) {
      const studentUser = await User.findById(application.student);
      if (studentUser && studentUser.memberId) {
        assignedStudentId = studentUser.memberId;
      } else {
        assignedStudentId = await generateNextMemberId('student');
      }
    }

    // Update Application Status & Office-use Details
    application.status = 'approved';
    application.rejectionReason = undefined;
    application.reviewedAt = new Date();
    application.reviewedBy = req.user?._id !== 'admin_master' ? req.user?._id : undefined;
    application.reviewedByName = req.user?.name || 'Administrator';

    application.officeUse = {
      registrationDate: registrationDate ? new Date(registrationDate) : application.officeUse?.registrationDate || new Date(),
      assignedTeacher: assignedTeacher !== undefined ? String(assignedTeacher).trim() : application.officeUse?.assignedTeacher || '',
      monthlyFee: monthlyFee !== undefined ? Number(monthlyFee) : application.officeUse?.monthlyFee || 0,
      studentId: assignedStudentId,
      classLevel: classLevel !== undefined ? String(classLevel).trim() : application.officeUse?.classLevel || application.program,
      startDate: startDate ? new Date(startDate) : application.officeUse?.startDate || undefined,
      officeNotes: officeNotes !== undefined ? String(officeNotes).trim() : application.officeUse?.officeNotes || '',
    };

    await application.save();

    // Update the associated User account: set status to 'approved', verified, memberId, classLevel
    let updatedUser = null;
    try {
      const user = await User.findById(application.student);
      if (user) {
        user.status = 'approved';
        user.isVerified = true;
        user.memberId = assignedStudentId;
        if (classLevel || application.officeUse?.classLevel) {
          user.classLevel = classLevel ? String(classLevel).trim() : application.officeUse.classLevel;
        }
        user.approvedAt = new Date();
        user.approvedBy = req.user?._id !== 'admin_master' ? req.user?._id : undefined;
        user.rejectionReason = undefined;
        await user.save();
        updatedUser = sanitizeUser(user);
      }
    } catch (userErr) {
      console.error('[Admission User Approval Sync Error]:', userErr);
    }

    console.log(
      `[Admission Approved] Application ${application._id} approved for ${application.fullName}. Assigned Student ID: ${assignedStudentId}`
    );

    return res.status(200).json({
      success: true,
      message: `Admission application approved successfully. Student ID: ${assignedStudentId}`,
      application,
      student: updatedUser,
    });
  } catch (error) {
    console.error('[ApproveAdmission Error]:', error);
    next(error);
  }
};

/**
 * @desc    Reject Student Admission Application (Admin only)
 * @route   PATCH /api/admin/admissions/:id/reject or POST /api/admin/admissions/:id/reject
 * @access  Private (Admin Auth required)
 */
const rejectAdmission = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, rejectionReason } = req.body;

    const finalReason = reason || rejectionReason
      ? String(reason || rejectionReason).trim()
      : 'Admission application was declined by the administration.';

    const application = await Admission.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Admission application not found.',
      });
    }

    // Update Application Status & Rejection details
    application.status = 'rejected';
    application.rejectionReason = finalReason;
    application.reviewedAt = new Date();
    application.reviewedBy = req.user?._id !== 'admin_master' ? req.user?._id : undefined;
    application.reviewedByName = req.user?.name || 'Administrator';

    await application.save();

    // Update the associated User account status to rejected
    let updatedUser = null;
    try {
      const user = await User.findById(application.student);
      if (user) {
        user.status = 'rejected';
        user.rejectionReason = finalReason;
        await user.save();
        updatedUser = sanitizeUser(user);
      }
    } catch (userErr) {
      console.error('[Admission User Rejection Sync Error]:', userErr);
    }

    console.log(`[Admission Rejected] Application ${application._id} rejected for ${application.fullName}`);

    return res.status(200).json({
      success: true,
      message: 'Admission application has been rejected.',
      application,
      student: updatedUser,
    });
  } catch (error) {
    console.error('[RejectAdmission Error]:', error);
    next(error);
  }
};

/**
 * @desc    Add or Update Office-Use Information (Admin only)
 * @route   PATCH /api/admin/admissions/:id/office-use or PUT /api/admin/admissions/:id/office-use
 * @access  Private (Admin Auth required)
 */
const updateOfficeUse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      registrationDate,
      assignedTeacher,
      monthlyFee,
      studentId,
      classLevel,
      startDate,
      officeNotes,
    } = req.body;

    const application = await Admission.findById(id);
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Admission application not found.',
      });
    }

    if (!application.officeUse) {
      application.officeUse = {};
    }

    if (registrationDate !== undefined) {
      application.officeUse.registrationDate = registrationDate ? new Date(registrationDate) : undefined;
    }
    if (assignedTeacher !== undefined) {
      application.officeUse.assignedTeacher = String(assignedTeacher).trim();
    }
    if (monthlyFee !== undefined) {
      const parsedFee = Number(monthlyFee);
      if (isNaN(parsedFee) || parsedFee < 0) {
        return res.status(400).json({ success: false, message: 'Monthly fee must be a valid non-negative number.' });
      }
      application.officeUse.monthlyFee = parsedFee;
    }
    if (studentId !== undefined) {
      application.officeUse.studentId = String(studentId).trim().toUpperCase();
    }
    if (classLevel !== undefined) {
      application.officeUse.classLevel = String(classLevel).trim();
    }
    if (startDate !== undefined) {
      application.officeUse.startDate = startDate ? new Date(startDate) : undefined;
    }
    if (officeNotes !== undefined) {
      application.officeUse.officeNotes = String(officeNotes).trim();
    }

    await application.save();

    // If studentId or classLevel changed, sync with User account if user exists
    if (studentId || classLevel) {
      try {
        const user = await User.findById(application.student);
        if (user) {
          if (studentId) user.memberId = String(studentId).trim().toUpperCase();
          if (classLevel) user.classLevel = String(classLevel).trim();
          await user.save();
        }
      } catch (userErr) {
        console.warn('[Office-Use User Sync Warning]:', userErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Office-use information updated successfully.',
      officeUse: application.officeUse,
      application,
    });
  } catch (error) {
    console.error('[UpdateOfficeUse Error]:', error);
    next(error);
  }
};

module.exports = {
  submitAdmission,
  getMyAdmission,
  getAdmissionById,
  getAdminAdmissions,
  approveAdmission,
  rejectAdmission,
  updateOfficeUse,
};
