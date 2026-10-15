const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const TeamMember = require('../models/TeamMember');
const User = require('../models/User');

const VALID_CATEGORIES = ['Leadership', 'Teacher', 'Administration'];

/**
 * Helper to normalize and validate category input
 */
const normalizeCategory = (categoryInput) => {
  if (!categoryInput || typeof categoryInput !== 'string') return null;
  const trimmed = categoryInput.trim().toLowerCase();
  if (trimmed === 'leadership') return 'Leadership';
  if (trimmed === 'teacher') return 'Teacher';
  if (trimmed === 'administration' || trimmed === 'admin') return 'Administration';
  return null;
};

/**
 * Helper to determine if an incoming request has valid admin credentials
 * (without sending a 401 response if unauthenticated)
 */
const isAdminRequest = async (req) => {
  const configuredApiKey = (process.env.ADMIN_API_KEY || '').trim();

  // 1. Check direct custom header key
  const customKey = (
    req.headers['x-admin-key'] ||
    req.headers['x-admin-api-key'] ||
    ''
  ).trim();

  if (configuredApiKey && customKey && customKey === configuredApiKey) {
    return true;
  }

  // 2. Check Authorization header or cookie token
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && (req.cookies.admin_token || req.cookies.token || req.cookies.admin_session)) {
    token = (req.cookies.admin_token || req.cookies.token || req.cookies.admin_session || '').trim();
  }

  if (!token) return false;

  // Direct key in Bearer token
  if (configuredApiKey && token === configuredApiKey) {
    return true;
  }

  // Verify as JWT
  try {
    const secret = process.env.JWT_SECRET || 'aic_jwt_default_secret_fallback_key_2026';
    const decoded = jwt.verify(token, secret);

    if (decoded.id === 'admin_master' || decoded.role === 'admin') {
      return true;
    }

    if (decoded.id) {
      const user = await User.findById(decoded.id).select('role isActive');
      if (user && user.role === 'admin' && user.isActive) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
};

/**
 * Optional Admin Authentication Middleware
 * Attaches req.isAdmin boolean for endpoints accessed by both public and admins
 */
const optionalAdminAuth = async (req, res, next) => {
  try {
    req.isAdmin = await isAdminRequest(req);
  } catch {
    req.isAdmin = false;
  }
  next();
};

/**
 * @desc    Get all team members (Public sees published; Admin can see all with filters)
 * @route   GET /api/team-members or GET /api/admin/team-members
 * @access  Public / Admin
 */
const getTeamMembers = async (req, res, next) => {
  try {
    const isAdmin = req.isAdmin || req.user?.role === 'admin' || (await isAdminRequest(req));
    const filter = {};

    // Publication filter
    if (!isAdmin) {
      // Public users strictly only see published team members
      filter.isPublished = true;
    } else {
      // Admins can filter by publication status if specified
      if (req.query.isPublished !== undefined && req.query.isPublished !== 'all') {
        filter.isPublished = req.query.isPublished === 'true' || req.query.isPublished === true;
      } else if (req.query.status === 'published') {
        filter.isPublished = true;
      } else if (req.query.status === 'unpublished') {
        filter.isPublished = false;
      }
    }

    // Category filter
    if (req.query.category && req.query.category !== 'all') {
      const normalized = normalizeCategory(req.query.category);
      if (normalized) {
        filter.category = normalized;
      } else {
        filter.category = req.query.category.trim();
      }
    }

    // Department filter
    if (req.query.department && req.query.department !== 'all') {
      filter.department = { $regex: req.query.department.trim(), $options: 'i' };
    }

    // Search query (fullName, designation, department, subject)
    if (req.query.search && String(req.query.search).trim()) {
      const term = String(req.query.search).trim();
      filter.$or = [
        { fullName: { $regex: term, $options: 'i' } },
        { designation: { $regex: term, $options: 'i' } },
        { department: { $regex: term, $options: 'i' } },
        { subject: { $regex: term, $options: 'i' } },
      ];
    }

    // Sorting: Primary sort by displayOrder ASC, then fallback to createdAt ASC
    const sort = { displayOrder: 1, createdAt: 1 };

    // Pagination (optional)
    const page = parseInt(req.query.page, 10);
    const limit = parseInt(req.query.limit, 10);

    let query = TeamMember.find(filter).sort(sort).lean();

    if (!isNaN(page) && !isNaN(limit) && page > 0 && limit > 0) {
      const skip = (page - 1) * limit;
      const [teamMembers, totalCount] = await Promise.all([
        query.skip(skip).limit(limit),
        TeamMember.countDocuments(filter),
      ]);

      return res.status(200).json({
        success: true,
        count: teamMembers.length,
        pagination: {
          totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
          hasNextPage: page * limit < totalCount,
          hasPrevPage: page > 1,
        },
        teamMembers,
      });
    }

    const teamMembers = await query;

    return res.status(200).json({
      success: true,
      count: teamMembers.length,
      teamMembers,
    });
  } catch (error) {
    console.error('[GetTeamMembers Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get single team member by ID
 * @route   GET /api/team-members/:id or GET /api/admin/team-members/:id
 * @access  Public (if published) / Admin (any)
 */
const getTeamMemberById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team member ID format.',
      });
    }

    const member = await TeamMember.findById(id).lean();

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found.',
      });
    }

    // If unpublished, require admin privileges to view
    if (!member.isPublished) {
      const isAdmin = req.isAdmin || req.user?.role === 'admin' || (await isAdminRequest(req));
      if (!isAdmin) {
        return res.status(404).json({
          success: false,
          message: 'Team member not found.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      teamMember: member,
    });
  } catch (error) {
    console.error('[GetTeamMemberById Error]:', error);
    next(error);
  }
};

/**
 * @desc    Create a new team member
 * @route   POST /api/team-members or POST /api/admin/team-members
 * @access  Private (Admin only)
 */
const createTeamMember = async (req, res, next) => {
  try {
    const {
      fullName,
      designation,
      category,
      qualifications,
      department,
      subject,
      biography,
      profileImage,
      responsibilities,
      displayOrder,
      isPublished,
    } = req.body;

    // Validate Required Fields
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required.',
      });
    }

    if (!designation || !String(designation).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Designation is required.',
      });
    }

    const normalizedCategory = normalizeCategory(category);
    if (!normalizedCategory) {
      return res.status(400).json({
        success: false,
        message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`,
      });
    }

    // Validate profile image string against massive embedded base64 data URIs
    if (profileImage && typeof profileImage === 'string') {
      const trimmedImg = profileImage.trim();
      if (trimmedImg.startsWith('data:') && trimmedImg.length > 512) {
        return res.status(400).json({
          success: false,
          message: 'Profile image must be an image URL or reference, not embedded base64 data.',
        });
      }
    }

    // Determine initial displayOrder
    let calculatedOrder = 0;
    if (displayOrder !== undefined && !isNaN(Number(displayOrder))) {
      calculatedOrder = Number(displayOrder);
    } else {
      // Default to next sequential display order within category
      const highestMember = await TeamMember.findOne({ category: normalizedCategory })
        .sort({ displayOrder: -1 })
        .select('displayOrder')
        .lean();
      calculatedOrder = highestMember ? (highestMember.displayOrder || 0) + 1 : 1;
    }

    const newMember = new TeamMember({
      fullName: String(fullName).trim(),
      designation: String(designation).trim(),
      category: normalizedCategory,
      qualifications: qualifications !== undefined ? qualifications : '',
      department: department ? String(department).trim() : '',
      subject: subject ? String(subject).trim() : '',
      biography: biography ? String(biography).trim() : '',
      profileImage: profileImage ? String(profileImage).trim() : '',
      responsibilities: responsibilities ? String(responsibilities).trim() : '',
      displayOrder: calculatedOrder,
      isPublished: Boolean(isPublished),
      createdBy: req.user?._id !== 'admin_master' ? req.user?._id : undefined,
    });

    await newMember.save();

    console.log(
      `[Team Member Created] ${newMember.fullName} (${newMember.designation}) in category '${newMember.category}' - Published: ${newMember.isPublished}`
    );

    return res.status(201).json({
      success: true,
      message: 'Team member created successfully.',
      teamMember: newMember,
    });
  } catch (error) {
    console.error('[CreateTeamMember Error]:', error);
    next(error);
  }
};

/**
 * @desc    Update an existing team member
 * @route   PATCH /api/team-members/:id or PUT /api/team-members/:id
 * @access  Private (Admin only)
 */
const updateTeamMember = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team member ID format.',
      });
    }

    const member = await TeamMember.findById(id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found.',
      });
    }

    const {
      fullName,
      designation,
      category,
      qualifications,
      department,
      subject,
      biography,
      profileImage,
      responsibilities,
      displayOrder,
      isPublished,
    } = req.body;

    if (fullName !== undefined) {
      if (!String(fullName).trim()) {
        return res.status(400).json({ success: false, message: 'Full name cannot be empty.' });
      }
      member.fullName = String(fullName).trim();
    }

    if (designation !== undefined) {
      if (!String(designation).trim()) {
        return res.status(400).json({ success: false, message: 'Designation cannot be empty.' });
      }
      member.designation = String(designation).trim();
    }

    if (category !== undefined) {
      const normalizedCategory = normalizeCategory(category);
      if (!normalizedCategory) {
        return res.status(400).json({
          success: false,
          message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}.`,
        });
      }
      member.category = normalizedCategory;
    }

    if (qualifications !== undefined) {
      member.qualifications = qualifications;
    }

    if (department !== undefined) {
      member.department = String(department).trim();
    }

    if (subject !== undefined) {
      member.subject = String(subject).trim();
    }

    if (biography !== undefined) {
      member.biography = String(biography).trim();
    }

    if (profileImage !== undefined) {
      const trimmedImg = String(profileImage).trim();
      if (trimmedImg.startsWith('data:') && trimmedImg.length > 512) {
        return res.status(400).json({
          success: false,
          message: 'Profile image must be an image URL or reference, not embedded base64 data.',
        });
      }
      member.profileImage = trimmedImg;
    }

    if (responsibilities !== undefined) {
      member.responsibilities = String(responsibilities).trim();
    }

    if (displayOrder !== undefined && !isNaN(Number(displayOrder))) {
      member.displayOrder = Number(displayOrder);
    }

    if (isPublished !== undefined) {
      member.isPublished = Boolean(isPublished);
    }

    member.updatedBy = req.user?._id !== 'admin_master' ? req.user?._id : undefined;

    await member.save();

    console.log(`[Team Member Updated] ID: ${member._id} - ${member.fullName}`);

    return res.status(200).json({
      success: true,
      message: 'Team member updated successfully.',
      teamMember: member,
    });
  } catch (error) {
    console.error('[UpdateTeamMember Error]:', error);
    next(error);
  }
};

/**
 * @desc    Publish / Unpublish a team member
 * @route   PATCH /api/team-members/:id/publish
 * @access  Private (Admin only)
 */
const publishTeamMember = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team member ID format.',
      });
    }

    const member = await TeamMember.findById(id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found.',
      });
    }

    // If explicit isPublished provided, set to it; otherwise toggle
    if (req.body && req.body.isPublished !== undefined) {
      member.isPublished = Boolean(req.body.isPublished);
    } else {
      member.isPublished = !member.isPublished;
    }

    member.updatedBy = req.user?._id !== 'admin_master' ? req.user?._id : undefined;

    await member.save();

    const actionText = member.isPublished ? 'published' : 'unpublished';
    console.log(`[Team Member Status Changed] ${member.fullName} is now ${actionText}`);

    return res.status(200).json({
      success: true,
      message: `Team member ${actionText} successfully.`,
      isPublished: member.isPublished,
      teamMember: member,
    });
  } catch (error) {
    console.error('[PublishTeamMember Error]:', error);
    next(error);
  }
};

/**
 * @desc    Delete a team member
 * @route   DELETE /api/team-members/:id
 * @access  Private (Admin only)
 */
const deleteTeamMember = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid team member ID format.',
      });
    }

    const member = await TeamMember.findByIdAndDelete(id);

    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Team member not found.',
      });
    }

    console.log(`[Team Member Deleted] ID: ${id} - ${member.fullName}`);

    return res.status(200).json({
      success: true,
      message: 'Team member deleted successfully.',
      id,
    });
  } catch (error) {
    console.error('[DeleteTeamMember Error]:', error);
    next(error);
  }
};

/**
 * @desc    Bulk reorder team members' displayOrder
 * @route   PATCH /api/team-members/reorder
 * @access  Private (Admin only)
 */
const reorderTeamMembers = async (req, res, next) => {
  try {
    const { orders } = req.body;

    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(400).json({
        success: false,
        message: "An array of '{ id, displayOrder }' objects is required.",
      });
    }

    const updatePromises = orders
      .filter((item) => item && mongoose.Types.ObjectId.isValid(item.id) && !isNaN(Number(item.displayOrder)))
      .map((item) =>
        TeamMember.findByIdAndUpdate(
          item.id,
          {
            $set: {
              displayOrder: Number(item.displayOrder),
              updatedBy: req.user?._id !== 'admin_master' ? req.user?._id : undefined,
            },
          },
          { new: true }
        )
      );

    await Promise.all(updatePromises);

    console.log(`[Team Members Reordered] Updated ${updatePromises.length} display orders`);

    return res.status(200).json({
      success: true,
      message: 'Team members display order updated successfully.',
      updatedCount: updatePromises.length,
    });
  } catch (error) {
    console.error('[ReorderTeamMembers Error]:', error);
    next(error);
  }
};

module.exports = {
  optionalAdminAuth,
  getTeamMembers,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  publishTeamMember,
  deleteTeamMember,
  reorderTeamMembers,
};
