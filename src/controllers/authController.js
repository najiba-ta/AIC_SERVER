const User = require('../models/User');
const generateToken = require('../utils/generateToken');

/**
 * Helper to build sanitized user response payload
 */
const sanitizeUser = (user) => {
  const avatar = user.profilePicture || user.profileImage || '';
  return {
    id: user._id ? user._id.toString() : user.id,
    _id: user._id ? user._id.toString() : user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    memberId: user.memberId || null,
    isVerified: Boolean(user.isVerified),
    status: user.status || 'pending',
    phone: user.phone || '',
    profileImage: avatar,
    profilePicture: avatar,
    bio: user.bio || '',
    gender: user.gender || '',
    dateOfBirth: user.dateOfBirth || null,
    address: user.address || '',
    subject: user.subject || '',
    qualification: user.qualification || '',
    guardianName: user.guardianName || '',
    guardianPhone: user.guardianPhone || '',
    classLevel: user.classLevel || '',
    admissionForm: user.admissionForm || null,
    admissionStatus: user.admissionStatus || (user.admissionForm ? (user.status || 'pending') : (user.role === 'student' ? 'not_submitted' : 'approved')),
    admissionSubmittedAt: user.admissionSubmittedAt || null,
    rejectionReason: user.rejectionReason || '',
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
};

/**
 * @desc    Register a new user (Student, Teacher, or General Donor)
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      profileImage,
      profilePicture,
      bio,
      gender,
      dateOfBirth,
      address,
      subject,
      qualification,
      guardianName,
      guardianPhone,
      classLevel,
    } = req.body;

    // Validate essential inputs
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Prevent duplicate email registration
    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists',
      });
    }

    // Determine role (strictly disallow public admin creation)
    let assignedRole = 'student';
    if (role) {
      const lowerRole = String(role).toLowerCase().trim();
      if (lowerRole === 'teacher') {
        assignedRole = 'teacher';
      } else if (lowerRole === 'user' || lowerRole === 'donor') {
        assignedRole = 'user';
      } else if (lowerRole === 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin registration is not allowed via public registration endpoint.',
        });
      } else {
        assignedRole = 'student';
      }
    }

    const avatar = (profilePicture || profileImage || '').trim();

    // Create user account with pending verification and NO official member ID
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: assignedRole,
      isVerified: false,
      status: 'pending',
      memberId: undefined, // Official member ID is strictly generated on admin approval
      phone: phone ? phone.trim() : undefined,
      profileImage: avatar,
      profilePicture: avatar,
      bio: bio ? bio.trim() : undefined,
      gender: gender ? gender.trim() : '',
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      address: address ? address.trim() : undefined,
      subject: subject ? subject.trim() : undefined,
      qualification: qualification ? qualification.trim() : undefined,
      guardianName: guardianName ? guardianName.trim() : undefined,
      guardianPhone: guardianPhone ? guardianPhone.trim() : undefined,
      classLevel: classLevel ? classLevel.trim() : undefined,
    });

    const token = generateToken(user._id, user.role);

    return res.status(201).json({
      success: true,
      message: `${assignedRole.charAt(0).toUpperCase() + assignedRole.slice(1)} registered successfully. Application is pending administrator verification.`,
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Auth Register Error]:', error);
    next(error);
  }
};

/**
 * @desc    Register a new Administrator account (Protected by master Admin API Key)
 * @route   POST /api/admin/register
 * @access  Restricted (Requires master Admin API Key)
 */
const registerAdmin = async (req, res, next) => {
  try {
    const { name, email, password, adminKey } = req.body;
    const configuredApiKey = process.env.ADMIN_API_KEY;

    const providedKey = adminKey || req.headers['x-admin-key'] || req.headers['x-admin-api-key'];

    if (!configuredApiKey || !providedKey || providedKey !== configuredApiKey) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. Admin registration requires a valid master Admin API Key.',
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password for the admin account',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Admin password must be at least 6 characters long',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists',
      });
    }

    const adminUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'admin',
      isVerified: true,
      status: 'approved',
    });

    const token = generateToken(adminUser._id, 'admin');

    return res.status(201).json({
      success: true,
      message: 'Admin account registered successfully',
      token,
      user: sanitizeUser(adminUser),
    });
  } catch (error) {
    console.error('[Admin Register Error]:', error);
    next(error);
  }
};

/**
 * @desc    Authenticate user (Student, Teacher, Admin, or User) & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email with password included
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact administration.',
      });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Update last login timestamp
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Auth Login Error]:', error);
    next(error);
  }
};

/**
 * @desc    Admin login via credentials or direct API Key
 * @route   POST /api/admin/login
 * @access  Public
 */
const adminLogin = async (req, res, next) => {
  try {
    const { email, password, apiKey } = req.body;
    const configuredApiKey = process.env.ADMIN_API_KEY;

    // Check if logging in via Direct API Key
    if (apiKey && configuredApiKey && apiKey === configuredApiKey) {
      const token = generateToken('admin_master', 'admin');
      return res.status(200).json({
        success: true,
        message: 'Admin authenticated via API Key',
        token,
        user: {
          id: 'admin_master',
          name: 'Master Administrator',
          email: 'admin@alhidayah.org',
          role: 'admin',
          isVerified: true,
          status: 'approved',
          memberId: 'ADM-0001',
        },
      });
    }

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password or a valid Admin API key',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || user.role !== 'admin') {
      // If no admin user exists in DB yet but admin API key matches password
      if (configuredApiKey && password === configuredApiKey) {
        const token = generateToken('admin_master', 'admin');
        return res.status(200).json({
          success: true,
          message: 'Admin authenticated successfully',
          token,
          user: {
            id: 'admin_master',
            name: 'Administrator',
            email: normalizedEmail,
            role: 'admin',
            isVerified: true,
            status: 'approved',
            memberId: 'ADM-0001',
          },
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials or insufficient permissions',
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin credentials',
      });
    }

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id, user.role);

    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Admin Login Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get currently logged-in user's own profile and verification status
 * @route   GET /api/auth/me
 * @access  Private (Self)
 */
const getMe = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Auth GetMe Error]:', error);
    next(error);
  }
};

/**
 * @desc    Update currently logged-in user's own profile
 * @route   PUT /api/auth/profile or PATCH /api/auth/profile
 * @access  Private (Self only)
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;

    if (userId === 'admin_master') {
      return res.status(200).json({
        success: true,
        message: 'Master administrator profile is static',
        user: sanitizeUser(req.user),
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Explicitly allow ONLY safe profile fields (Prevent tampering with role, isVerified, status, memberId)
    const {
      name,
      phone,
      profileImage,
      profilePicture,
      bio,
      gender,
      dateOfBirth,
      address,
      subject,
      qualification,
      guardianName,
      guardianPhone,
      classLevel,
    } = req.body;

    if (name) user.name = name.trim();
    if (phone !== undefined) user.phone = phone.trim();
    
    const newAvatar = profilePicture !== undefined ? profilePicture : profileImage;
    if (newAvatar !== undefined) {
      user.profileImage = newAvatar.trim();
      user.profilePicture = newAvatar.trim();
    }
    
    if (bio !== undefined) user.bio = bio.trim();
    if (gender !== undefined) user.gender = gender.trim();
    if (dateOfBirth) user.dateOfBirth = new Date(dateOfBirth);
    if (address !== undefined) user.address = address.trim();

    // Teacher fields
    if (user.role === 'teacher') {
      if (subject !== undefined) user.subject = subject.trim();
      if (qualification !== undefined) user.qualification = qualification.trim();
    }

    // Student fields
    if (user.role === 'student') {
      if (guardianName !== undefined) user.guardianName = guardianName.trim();
      if (guardianPhone !== undefined) user.guardianPhone = guardianPhone.trim();
      if (classLevel !== undefined) user.classLevel = classLevel.trim();
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Auth UpdateProfile Error]:', error);
    next(error);
  }
};

/**
 * @desc    Logout user / invalidate session client-side
 * @route   POST /api/auth/logout
 * @access  Public
 */
const logout = async (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};


/**
 * @desc    Submit Student Admission Application Form
 * @route   POST /api/auth/admission
 * @access  Private (Student)
 */
const submitAdmission = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Student account not found',
      });
    }

    if (user.role !== 'student') {
      return res.status(400).json({
        success: false,
        message: 'Only registered student accounts can submit student admission forms',
      });
    }

    // Do not create duplicate applications for the same student
    if (user.admissionStatus === 'pending' || user.admissionStatus === 'approved') {
      return res.status(409).json({
        success: false,
        message: 'An admission application for this student has already been submitted and is currently ' + user.admissionStatus,
        admissionForm: user.admissionForm,
        admissionStatus: user.admissionStatus,
      });
    }

    const formData = req.body;
    user.admissionForm = {
      ...formData,
      submittedAt: new Date(),
    };
    user.admissionStatus = 'pending';
    user.admissionSubmittedAt = new Date();
    user.status = 'pending';
    user.isVerified = false;

    // Synchronize core fields from admission form into user document
    if (formData.studentInfo?.fullName) user.name = formData.studentInfo.fullName.trim();
    if (formData.studentInfo?.gender) { const g = formData.studentInfo.gender.toLowerCase(); user.gender = (g === 'boy' || g === 'male') ? 'boy' : (g === 'girl' || g === 'female') ? 'girl' : 'other'; }
    if (formData.studentInfo?.dateOfBirth) user.dateOfBirth = new Date(formData.studentInfo.dateOfBirth);
    if (formData.studentInfo?.homeAddress) {
      user.address = [formData.studentInfo.homeAddress, formData.studentInfo.cityStateZip].filter(Boolean).join(', ');
    }
    if (formData.parentInfo?.guardianName) user.guardianName = formData.parentInfo.guardianName.trim();
    if (formData.parentInfo?.phoneWhatsApp) user.guardianPhone = formData.parentInfo.phoneWhatsApp.trim();
    if (formData.parentInfo?.phoneWhatsApp && !user.phone) user.phone = formData.parentInfo.phoneWhatsApp.trim();

    await user.save();

    console.log('[Admission Form Submitted] Student: ' + user.name + ' (' + user.email + ') - Status: Pending Admin Review');

    return res.status(201).json({
      success: true,
      message: 'Application Submitted / Pending Admin Review',
      admissionStatus: 'pending',
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Submit Admission Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get Current Student Admission Application Form
 * @route   GET /api/auth/admission
 * @access  Private (Student)
 */
const getAdmission = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found',
      });
    }

    return res.status(200).json({
      success: true,
      admissionForm: user.admissionForm || null,
      admissionStatus: user.admissionStatus || 'not_submitted',
      admissionSubmittedAt: user.admissionSubmittedAt || null,
      rejectionReason: user.rejectionReason || '',
      status: user.status || 'pending',
      memberId: user.memberId || null,
    });
  } catch (error) {
    console.error('[Get Admission Error]:', error);
    next(error);
  }
};

module.exports = {
  submitAdmission,
  getAdmission,
  register,
  registerAdmin,
  login,
  adminLogin,
  getMe,
  updateProfile,
  logout,
  sanitizeUser,
};
