const Donation = require('../models/Donation');
const User = require('../models/User');
const generateNextMemberId = require('../utils/generateMemberId');
const { sanitizeUser } = require('./authController');

/**
 * @desc    Get verified donations and summary statistics for the Admin Dashboard
 * @route   GET /api/admin/donations
 * @access  Private (Admin Auth required)
 */
const getDonations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status || 'completed';
    const searchQuery = req.query.search ? req.query.search.trim() : '';

    // Build filter query
    const filter = {};

    if (statusFilter && statusFilter !== 'all') {
      filter.status = statusFilter;
    }

    if (searchQuery) {
      filter.$or = [
        { donorName: { $regex: searchQuery, $options: 'i' } },
        { donorEmail: { $regex: searchQuery, $options: 'i' } },
        { category: { $regex: searchQuery, $options: 'i' } },
        { stripeSessionId: { $regex: searchQuery, $options: 'i' } },
        { stripePaymentIntentId: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    // Fetch paginated donations & total document count
    const [donations, totalCount, recentDonationsList] = await Promise.all([
      Donation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Donation.countDocuments(filter),
      Donation.find({ status: 'completed' })
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    // Calculate overall verified totals and metrics using MongoDB Aggregation
    const statsResult = await Donation.aggregate([
      {
        $facet: {
          completedStats: [
            { $match: { status: 'completed' } },
            {
              $group: {
                _id: null,
                totalAmount: { $sum: '$amount' },
                totalCount: { $sum: 1 },
                avgAmount: { $avg: '$amount' },
              },
            },
          ],
          allStatusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
              },
            },
          ],
        },
      },
    ]);

    const completed = statsResult[0]?.completedStats[0] || {
      totalAmount: 0,
      totalCount: 0,
      avgAmount: 0,
    };

    const statusCounts = (statsResult[0]?.allStatusCounts || []).reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const stats = {
      totalAmount: Number((completed.totalAmount || 0).toFixed(2)),
      totalDonations: completed.totalCount || 0,
      totalVerifiedDonations: completed.totalCount || 0,
      averageDonation: Number((completed.avgAmount || 0).toFixed(2)),
      pendingDonations: statusCounts.pending || 0,
      failedDonations: statusCounts.failed || 0,
    };

    return res.status(200).json({
      success: true,
      stats,
      recentDonations: recentDonationsList,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
      donations,
    });
  } catch (error) {
    console.error('[Admin Donations Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get overall admin dashboard statistics
 * @route   GET /api/admin/stats
 * @access  Private (Admin Auth required)
 */
const getAdminStats = async (req, res, next) => {
  try {
    const [donationAgg, userAgg, recentDonations] = await Promise.all([
      Donation.aggregate([
        {
          $group: {
            _id: '$status',
            totalAmount: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
      ]),
      User.aggregate([
        {
          $group: {
            _id: { role: '$role', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ]),
      Donation.find({ status: 'completed' })
        .sort({ paidAt: -1, createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    let totalCompletedAmount = 0;
    let totalCompletedCount = 0;
    let totalPendingDonations = 0;

    donationAgg.forEach((item) => {
      if (item._id === 'completed') {
        totalCompletedAmount = item.totalAmount;
        totalCompletedCount = item.count;
      } else if (item._id === 'pending') {
        totalPendingDonations = item.count;
      }
    });

    let pendingStudents = 0;
    let pendingTeachers = 0;
    let verifiedStudents = 0;
    let verifiedTeachers = 0;
    let totalUsers = 0;

    userAgg.forEach((item) => {
      const { role, status } = item._id;
      totalUsers += item.count;

      if (role === 'student') {
        if (status === 'pending') pendingStudents += item.count;
        if (status === 'approved') verifiedStudents += item.count;
      } else if (role === 'teacher') {
        if (status === 'pending') pendingTeachers += item.count;
        if (status === 'approved') verifiedTeachers += item.count;
      }
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalAmount: Number(totalCompletedAmount.toFixed(2)),
        totalDonations: totalCompletedCount,
        pendingDonations: totalPendingDonations,
        totalUsers,
        pendingApplications: pendingStudents + pendingTeachers,
        pendingStudents,
        pendingTeachers,
        verifiedStudents,
        verifiedTeachers,
        recentDonations,
      },
    });
  } catch (error) {
    console.error('[Admin Stats Error]:', error);
    next(error);
  }
};

/**
 * @desc    List student and teacher applications (Pending, Approved, Rejected)
 * @route   GET /api/admin/applications or GET /api/admin/users
 * @access  Private (Admin Auth required)
 */
const getApplications = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const roleFilter = req.query.role; // 'student' | 'teacher' | 'all'
    const statusFilter = req.query.status; // 'pending' | 'approved' | 'rejected' | 'all'
    const searchQuery = req.query.search ? req.query.search.trim() : '';

    const filter = {};

    if (roleFilter && roleFilter !== 'all') {
      filter.role = roleFilter;
    } else {
      // By default list students and teachers unless specified
      if (!req.query.includeAll) {
        filter.role = { $in: ['student', 'teacher', 'user'] };
      }
    }

    if (statusFilter && statusFilter !== 'all') {
      filter.status = statusFilter;
    }

    if (searchQuery) {
      filter.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
        { memberId: { $regex: searchQuery, $options: 'i' } },
        { subject: { $regex: searchQuery, $options: 'i' } },
        { guardianName: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    const [rawUsers, totalCount, countsResult, pendingStudentsRaw, pendingTeachersRaw] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
      User.aggregate([
        {
          $group: {
            _id: { role: '$role', status: '$status' },
            count: { $sum: 1 },
          },
        },
      ]),
      User.find({ role: 'student', status: 'pending' })
        .sort({ createdAt: -1 })
        .lean(),
      User.find({ role: 'teacher', status: 'pending' })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const users = rawUsers.map(sanitizeUser);
    const pendingStudents = pendingStudentsRaw.map(sanitizeUser);
    const pendingTeachers = pendingTeachersRaw.map(sanitizeUser);

    const counts = {
      pendingStudents: 0,
      pendingTeachers: 0,
      approvedStudents: 0,
      approvedTeachers: 0,
      rejectedTotal: 0,
      totalPending: 0,
    };

    countsResult.forEach((item) => {
      const { role, status } = item._id;
      if (role === 'student' && status === 'pending') counts.pendingStudents += item.count;
      if (role === 'teacher' && status === 'pending') counts.pendingTeachers += item.count;
      if (role === 'student' && status === 'approved') counts.approvedStudents += item.count;
      if (role === 'teacher' && status === 'approved') counts.approvedTeachers += item.count;
      if (status === 'rejected') counts.rejectedTotal += item.count;
    });

    counts.totalPending = counts.pendingStudents + counts.pendingTeachers;

    return res.status(200).json({
      success: true,
      counts,
      pendingStudents,
      pendingTeachers,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
        hasNextPage: page * limit < totalCount,
        hasPrevPage: page > 1,
      },
      users,
      applications: users, // Aliased for seamless frontend consumption
    });
  } catch (error) {
    console.error('[Admin GetApplications Error]:', error);
    next(error);
  }
};

/**
 * @desc    Approve Student or Teacher application and atomically assign unique sequential Member ID
 * @route   PATCH /api/admin/applications/:id/approve or POST /api/admin/applications/:id/approve
 * @access  Private (Admin Auth required)
 */
const approveApplication = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Application/User not found',
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts do not require student/teacher member verification',
      });
    }

    // Idempotency: If already approved with an assigned memberId, preserve existing ID
    if (user.status === 'approved' && user.memberId && user.isVerified) {
      return res.status(200).json({
        success: true,
        message: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} is already approved and verified.`,
        user: sanitizeUser(user),
      });
    }

    // Atomically generate the next sequential unique member ID for their role (STU-0001 or TEA-0001)
    let assignedId = user.memberId;
    if (!assignedId) {
      assignedId = await generateNextMemberId(user.role);
    }

    // Update approval status
    user.status = 'approved';
    user.isVerified = true;
    user.memberId = assignedId;
    user.admissionStatus = 'approved';
    user.approvedAt = new Date();
    user.approvedBy = req.user?._id !== 'admin_master' ? req.user?._id : undefined;
    user.rejectionReason = undefined;

    await user.save();

    console.log(
      `[Admin Approval] Approved ${user.role} ${user.name} (${user.email}) -> Assigned Member ID: ${assignedId}`
    );

    return res.status(200).json({
      success: true,
      message: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} approved successfully. Assigned Member ID: ${assignedId}`,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Admin Approve Error]:', error);
    next(error);
  }
};

/**
 * @desc    Reject Student or Teacher application
 * @route   PATCH /api/admin/applications/:id/reject or POST /api/admin/applications/:id/reject
 * @access  Private (Admin Auth required)
 */
const rejectApplication = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Application/User not found',
      });
    }

    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot reject an administrator account',
      });
    }

    user.status = 'rejected';
    user.isVerified = false;
    user.memberId = undefined;
    user.admissionStatus = 'rejected';
    user.rejectionReason = reason ? String(reason).trim() : 'Application declined by administration';

    await user.save();

    console.log(`[Admin Rejection] Rejected ${user.role} ${user.name} (${user.email})`);

    return res.status(200).json({
      success: true,
      message: `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} application was rejected.`,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('[Admin Reject Error]:', error);
    next(error);
  }
};

module.exports = {
  getDonations,
  getAdminStats,
  getApplications,
  getUsers: getApplications, // Alias for backward compatibility
  approveApplication,
  rejectApplication,
};
