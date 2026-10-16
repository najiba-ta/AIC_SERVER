const express = require('express');
const {
  optionalAdminAuth,
  getTeamMembers,
  getTeamMemberById,
  createTeamMember,
  updateTeamMember,
  publishTeamMember,
  deleteTeamMember,
  reorderTeamMembers,
} = require('../controllers/teamMemberController');
const { requireAdminAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Public listing (optional admin authentication allows admins to view unpublished records and filter)
router.get('/', optionalAdminAuth, getTeamMembers);

// Protected Admin reorder endpoint (must be defined before /:id)
router.patch('/reorder', requireAdminAuth, reorderTeamMembers);
router.post('/reorder', requireAdminAuth, reorderTeamMembers);
router.put('/reorder', requireAdminAuth, reorderTeamMembers);

// Protected Admin bulk/body-based publish endpoints (must be defined before /:id)
router.patch('/publish', requireAdminAuth, publishTeamMember);
router.post('/publish', requireAdminAuth, publishTeamMember);
router.put('/publish', requireAdminAuth, publishTeamMember);

// Public / Admin single member retrieval
router.get('/:id', optionalAdminAuth, getTeamMemberById);

// Admin-only member management
router.post('/', requireAdminAuth, createTeamMember);
router.patch('/:id/publish', requireAdminAuth, publishTeamMember);
router.post('/:id/publish', requireAdminAuth, publishTeamMember);
router.put('/:id/publish', requireAdminAuth, publishTeamMember);
router.patch('/:id', requireAdminAuth, updateTeamMember);
router.put('/:id', requireAdminAuth, updateTeamMember);
router.post('/:id', requireAdminAuth, updateTeamMember);
router.delete('/:id', requireAdminAuth, deleteTeamMember);

module.exports = router;
