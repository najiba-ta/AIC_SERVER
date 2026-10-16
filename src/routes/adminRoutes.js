const express = require('express');
const {
  getDonations,
  getAdminStats,
  getApplications,
  approveApplication,
  rejectApplication,
} = require('../controllers/adminController');
const {
  getAdminAdmissions,
  getAdmissionById,
  approveAdmission,
  rejectAdmission,
  updateOfficeUse,
} = require('../controllers/admissionController');
const {
  getAdminTeacherApplications,
  getTeacherApplicationById,
  approveTeacherApplication,
  rejectTeacherApplication,
} = require('../controllers/teacherApplicationController');
const { adminLogin, registerAdmin } = require('../controllers/authController');
const { requireAdminAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Admin Registration (Requires master Admin API Key)
router.post('/register', registerAdmin);

// Public Admin Login endpoint
router.post('/login', adminLogin);

// All routes below require Admin Authentication (JWT or x-admin-key / Bearer API Key)
router.use(requireAdminAuth);

// Dashboard queries
router.get('/donations', getDonations);
router.get('/stats', getAdminStats);
router.get('/applications', getApplications);
router.get('/users', getApplications);

// Member Registration Approval & Rejection (Supports both /applications/:id and /users/:id with PATCH or POST)
router.patch('/applications/:id/approve', approveApplication);
router.post('/applications/:id/approve', approveApplication);
router.patch('/applications/:id/reject', rejectApplication);
router.post('/applications/:id/reject', rejectApplication);

router.patch('/users/:id/approve', approveApplication);
router.post('/users/:id/approve', approveApplication);
router.patch('/users/:id/reject', rejectApplication);
router.post('/users/:id/reject', rejectApplication);

// Student Admission Applications Management (Full Admission Forms)
router.get('/admissions', getAdminAdmissions);
router.get('/admissions/:id', getAdmissionById);
router.patch('/admissions/:id/approve', approveAdmission);
router.post('/admissions/:id/approve', approveAdmission);
router.patch('/admissions/:id/reject', rejectAdmission);
router.post('/admissions/:id/reject', rejectAdmission);
router.patch('/admissions/:id/office-use', updateOfficeUse);
router.put('/admissions/:id/office-use', updateOfficeUse);
router.patch('/admissions/:id', updateOfficeUse);

// Teacher Employment Applications Management (Full Application Forms)
router.get('/teacher-applications', getAdminTeacherApplications);
router.get('/teacher-applications/:id', getTeacherApplicationById);
router.patch('/teacher-applications/:id/approve', approveTeacherApplication);
router.post('/teacher-applications/:id/approve', approveTeacherApplication);
router.patch('/teacher-applications/:id/reject', rejectTeacherApplication);
router.post('/teacher-applications/:id/reject', rejectTeacherApplication);

// Leadership & Team Member Management
const {
  getTeamMembers,
  getTeamMemberById: getAdminTeamMemberById,
  createTeamMember,
  updateTeamMember,
  publishTeamMember,
  deleteTeamMember,
  reorderTeamMembers,
} = require('../controllers/teamMemberController');

// Listing & Creation (Collection routes)
router.get('/team-members', getTeamMembers);
router.post('/team-members', createTeamMember);

// Reordering endpoints (Support PATCH, POST, PUT before /:id)
router.patch('/team-members/reorder', reorderTeamMembers);
router.post('/team-members/reorder', reorderTeamMembers);
router.put('/team-members/reorder', reorderTeamMembers);

// Bulk/Body-based publish endpoints (before /:id)
router.patch('/team-members/publish', publishTeamMember);
router.post('/team-members/publish', publishTeamMember);
router.put('/team-members/publish', publishTeamMember);

// Member-specific publish endpoints (Support PATCH, POST, PUT)
router.patch('/team-members/:id/publish', publishTeamMember);
router.post('/team-members/:id/publish', publishTeamMember);
router.put('/team-members/:id/publish', publishTeamMember);

// Single Member Retrieval
router.get('/team-members/:id', getAdminTeamMemberById);

// Member Updates (Support PATCH, PUT, POST)
router.patch('/team-members/:id', updateTeamMember);
router.put('/team-members/:id', updateTeamMember);
router.post('/team-members/:id', updateTeamMember);

// Member Deletion
router.delete('/team-members/:id', deleteTeamMember);

// Contact Inquiries & Form Audit Logs
const {
  getContactMessages,
  getContactMessageById,
} = require('../controllers/contactController');

router.get('/contact-messages', getContactMessages);
router.get('/contact-messages/:id', getContactMessageById);

module.exports = router;

