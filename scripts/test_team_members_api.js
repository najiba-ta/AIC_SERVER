const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const TeamMember = require('../src/models/TeamMember');
const generateToken = require('../src/utils/generateToken');
const app = require('../server');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING LEADERSHIP & TEAM MEMBERS API REGRESSION TESTS');
  console.log('====================================================\n');

  let server;
  const createdMemberIds = [];

  try {
    await connectDB();
    await TeamMember.deleteMany({ fullName: { $regex: /Test|Sheikh Abdullah|Ustadh Tariq|Sister Maryam|Admin Gateway/i } });

    // Start server on an ephemeral port
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`✓ Test server running on ${baseUrl}`);

    // Helper for making HTTP requests
    async function apiRequest(endpoint, options = {}) {
      const url = `${baseUrl}${endpoint}`;
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };
      const res = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
      const data = await res.json().catch(() => null);
      return { status: res.status, body: data };
    }

    const adminKey = process.env.ADMIN_API_KEY;

    // -------------------------------------------------------------------------
    // TEST 1: Security - Unauthorized Users Cannot Perform Mutations
    // -------------------------------------------------------------------------
    const unauthorizedCreate = await apiRequest('/api/team-members', {
      method: 'POST',
      body: {
        fullName: 'Hacker User',
        designation: 'Fake Director',
        category: 'Leadership',
      },
    });

    if (unauthorizedCreate.status === 401 && unauthorizedCreate.body.success === false) {
      console.log('✓ 1a. Security test passed: Unauthenticated POST /api/team-members rejected with 401.');
    } else {
      throw new Error(`Expected 401 for unauthenticated create, got ${unauthorizedCreate.status}`);
    }

    const dummyId = new mongoose.Types.ObjectId().toString();

    const unauthorizedPatch = await apiRequest(`/api/team-members/${dummyId}`, {
      method: 'PATCH',
      body: { designation: 'Updated' },
    });
    if (unauthorizedPatch.status === 401) {
      console.log('✓ 1b. Security test passed: Unauthenticated PATCH /api/team-members/:id rejected with 401.');
    } else {
      throw new Error(`Expected 401 for unauthenticated patch, got ${unauthorizedPatch.status}`);
    }

    const unauthorizedDelete = await apiRequest(`/api/team-members/${dummyId}`, {
      method: 'DELETE',
    });
    if (unauthorizedDelete.status === 401) {
      console.log('✓ 1c. Security test passed: Unauthenticated DELETE /api/team-members/:id rejected with 401.');
    } else {
      throw new Error(`Expected 401 for unauthenticated delete, got ${unauthorizedDelete.status}`);
    }

    const unauthorizedPublish = await apiRequest(`/api/team-members/${dummyId}/publish`, {
      method: 'PATCH',
      body: { isPublished: true },
    });
    if (unauthorizedPublish.status === 401) {
      console.log('✓ 1d. Security test passed: Unauthenticated PATCH /api/team-members/:id/publish rejected with 401.');
    } else {
      throw new Error(`Expected 401 for unauthenticated publish, got ${unauthorizedPublish.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Validation of Required Fields and Safe Inputs
    // -------------------------------------------------------------------------
    // 2a. Missing full name
    const missingName = await apiRequest('/api/team-members', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: {
        designation: 'Principal',
        category: 'Leadership',
      },
    });
    if (missingName.status === 400 && missingName.body.message.includes('Full name is required')) {
      console.log('✓ 2a. Validation passed: Missing full name rejected with 400.');
    } else {
      throw new Error(`Expected 400 for missing full name, got ${missingName.status}`);
    }

    // 2b. Missing designation
    const missingDesignation = await apiRequest('/api/team-members', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: {
        fullName: 'Dr. Ahmad Farooq',
        category: 'Leadership',
      },
    });
    if (missingDesignation.status === 400 && missingDesignation.body.message.includes('Designation is required')) {
      console.log('✓ 2b. Validation passed: Missing designation rejected with 400.');
    } else {
      throw new Error(`Expected 400 for missing designation, got ${missingDesignation.status}`);
    }

    // 2c. Invalid category
    const invalidCategory = await apiRequest('/api/team-members', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: {
        fullName: 'Dr. Ahmad Farooq',
        designation: 'Advisor',
        category: 'Volunteer', // Invalid, must be Leadership, Teacher, or Administration
      },
    });
    if (invalidCategory.status === 400 && invalidCategory.body.message.includes('Invalid category')) {
      console.log('✓ 2c. Validation passed: Invalid category rejected with 400.');
    } else {
      throw new Error(`Expected 400 for invalid category, got ${invalidCategory.status}`);
    }

    // 2d. Massive Base64 image payload rejected
    const hugeBase64 = 'data:image/png;base64,' + 'A'.repeat(1000);
    const massiveImageRes = await apiRequest('/api/team-members', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: {
        fullName: 'Dr. Ahmad Farooq',
        designation: 'Advisor',
        category: 'Leadership',
        profileImage: hugeBase64,
      },
    });
    if (massiveImageRes.status === 400 && massiveImageRes.body.message.includes('base64')) {
      console.log('✓ 2d. Validation passed: Massive base64 image data rejected with 400.');
    } else {
      throw new Error(`Expected 400 for massive base64 image, got ${massiveImageRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Admin Member Creation with Custom Designations
    // -------------------------------------------------------------------------
    // Member 1: Leadership (Chairman) - Published
    const member1Res = await apiRequest('/api/team-members', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: {
        fullName: 'Sheikh Abdullah Al-Mansoor',
        designation: 'Chairman & Religious Director', // Custom title
        category: 'Leadership',
        qualifications: ['Ph.D. Islamic Jurisprudence, Al-Azhar', 'Ijazah in Ten Qiraat'],
        department: 'Executive Board',
        biography: 'Serving the community for over 15 years with dedication to classical Islamic learning and social welfare.',
        profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500',
        responsibilities: 'Oversees religious guidance, center expansion, and community outreach programs.',
        displayOrder: 1,
        isPublished: true,
      },
    });

    if (member1Res.status === 201 && member1Res.body.teamMember._id) {
      createdMemberIds.push(member1Res.body.teamMember._id);
      console.log(`✓ 3a. Admin created Leadership member (ID: ${member1Res.body.teamMember._id}, Title: '${member1Res.body.teamMember.designation}').`);
    } else {
      throw new Error(`Expected 201 for member creation, got ${member1Res.status}`);
    }

    // Member 2: Teacher (Academic Coordinator & Head Teacher) - Published
    const member2Res = await apiRequest('/api/team-members', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: {
        fullName: 'Ustadh Tariq Aziz',
        designation: 'Head Teacher & Academic Coordinator', // Custom title
        category: 'Teacher',
        qualifications: 'B.A. Arabic & Islamic Studies, M.Ed. Curriculum Design',
        department: 'Quranic & Arabic Academy',
        subject: 'Quran, Tajweed & Hifz',
        biography: 'Passionate educator specializing in youth Quran recitation and memorization techniques.',
        profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500',
        responsibilities: 'Manages Madrasa curriculum, faculty scheduling, and student assessments.',
        displayOrder: 2,
        isPublished: true,
      },
    });

    if (member2Res.status === 201 && member2Res.body.teamMember._id) {
      createdMemberIds.push(member2Res.body.teamMember._id);
      console.log(`✓ 3b. Admin created Teacher member (ID: ${member2Res.body.teamMember._id}, Title: '${member2Res.body.teamMember.designation}').`);
    } else {
      throw new Error(`Expected 201 for teacher creation, got ${member2Res.status}`);
    }

    // Member 3: Administration (Operations Manager) - UNPUBLISHED
    const member3Res = await apiRequest('/api/team-members', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: {
        fullName: 'Sister Maryam Khan',
        designation: 'General Operations & Admissions Director', // Custom title
        category: 'Administration',
        qualifications: 'B.Sc. Business Administration',
        department: 'Administrative Services',
        biography: 'Directs day-to-day administrative operations and community event logistics.',
        profileImage: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=500',
        displayOrder: 3,
        isPublished: false, // Intentionally unpublished for testing privacy controls
      },
    });

    if (member3Res.status === 201 && member3Res.body.teamMember._id) {
      createdMemberIds.push(member3Res.body.teamMember._id);
      console.log(`✓ 3c. Admin created Administration member (ID: ${member3Res.body.teamMember._id}, isPublished: false).`);
    } else {
      throw new Error(`Expected 201 for admin member creation, got ${member3Res.status}`);
    }

    const publishedMemberId = member1Res.body.teamMember._id;
    const unpublishedMemberId = member3Res.body.teamMember._id;

    // -------------------------------------------------------------------------
    // TEST 4: Public Access - Only Published Members Are Returned
    // -------------------------------------------------------------------------
    const publicList = await apiRequest('/api/team-members');

    if (publicList.status === 200 && Array.isArray(publicList.body.teamMembers)) {
      const hasUnpublished = publicList.body.teamMembers.some((m) => m._id === unpublishedMemberId);
      const hasPublished1 = publicList.body.teamMembers.some((m) => m._id === publishedMemberId);

      if (!hasUnpublished && hasPublished1) {
        console.log(`✓ 4. Public access verified: Public GET /api/team-members returned ${publicList.body.count} members; unpublished member is strictly excluded.`);
      } else {
        throw new Error('Public list leaked an unpublished member or missed a published member');
      }
    } else {
      throw new Error(`Expected 200 for public list, got ${publicList.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Category Filtering
    // -------------------------------------------------------------------------
    const teacherCategoryList = await apiRequest('/api/team-members?category=Teacher');
    if (
      teacherCategoryList.status === 200 &&
      teacherCategoryList.body.teamMembers.every((m) => m.category === 'Teacher')
    ) {
      console.log('✓ 5a. Category filtering verified: /api/team-members?category=Teacher returned only teachers.');
    } else {
      throw new Error('Category filter failed for Teacher');
    }

    // Case-insensitive category check
    const leadershipCategoryList = await apiRequest('/api/team-members?category=leadership');
    if (
      leadershipCategoryList.status === 200 &&
      leadershipCategoryList.body.teamMembers.every((m) => m.category === 'Leadership')
    ) {
      console.log('✓ 5b. Case-insensitive category filtering verified: ?category=leadership normalized properly.');
    } else {
      throw new Error('Case-insensitive category filter failed');
    }

    // -------------------------------------------------------------------------
    // TEST 6: Single Member Access & Privacy Controls
    // -------------------------------------------------------------------------
    // 6a. Public user accesses published member -> 200 OK
    const publicGetPublished = await apiRequest(`/api/team-members/${publishedMemberId}`);
    if (publicGetPublished.status === 200 && publicGetPublished.body.teamMember._id === publishedMemberId) {
      console.log('✓ 6a. Public single-member retrieval: Published profile returned with 200 OK.');
    } else {
      throw new Error(`Expected 200 for public get published, got ${publicGetPublished.status}`);
    }

    // 6b. Public user accesses unpublished member -> 404 Not Found
    const publicGetUnpublished = await apiRequest(`/api/team-members/${unpublishedMemberId}`);
    if (publicGetUnpublished.status === 404) {
      console.log('✓ 6b. Privacy control verified: Public access to unpublished profile returned 404 Not Found.');
    } else {
      throw new Error(`Expected 404 for public get unpublished, got ${publicGetUnpublished.status}`);
    }

    // 6c. Admin accesses unpublished member -> 200 OK
    const adminGetUnpublished = await apiRequest(`/api/team-members/${unpublishedMemberId}`, {
      headers: { 'x-admin-key': adminKey },
    });
    if (adminGetUnpublished.status === 200 && adminGetUnpublished.body.teamMember._id === unpublishedMemberId) {
      console.log('✓ 6c. Admin access verified: Authorized admin successfully accessed unpublished record.');
    } else {
      throw new Error(`Expected 200 for admin get unpublished, got ${adminGetUnpublished.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Admin Member Editing (PATCH)
    // -------------------------------------------------------------------------
    const patchRes = await apiRequest(`/api/team-members/${publishedMemberId}`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: {
        designation: 'Executive Chairman & Senior Scholar',
        department: 'Executive Shura Board',
      },
    });

    if (
      patchRes.status === 200 &&
      patchRes.body.teamMember.designation === 'Executive Chairman & Senior Scholar' &&
      patchRes.body.teamMember.department === 'Executive Shura Board'
    ) {
      console.log('✓ 7. Admin member editing: PATCH updated designation and department successfully.');
    } else {
      throw new Error(`Expected 200 for patch, got ${patchRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Admin Publishing & Unpublishing (PATCH /:id/publish)
    // -------------------------------------------------------------------------
    // Publish member 3 (was false -> now true)
    const publishRes = await apiRequest(`/api/team-members/${unpublishedMemberId}/publish`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: { isPublished: true },
    });

    if (publishRes.status === 200 && publishRes.body.isPublished === true) {
      // Verify public now sees member 3
      const publicCheckAfterPublish = await apiRequest(`/api/team-members/${unpublishedMemberId}`);
      if (publicCheckAfterPublish.status === 200) {
        console.log('✓ 8a. Publishing action passed: Admin published member; member is now visible to public users.');
      } else {
        throw new Error('Public cannot see member after publish');
      }
    } else {
      throw new Error(`Expected 200 for publish, got ${publishRes.status}`);
    }

    // Unpublish member 3 (toggle or explicit false)
    const unpublishRes = await apiRequest(`/api/team-members/${unpublishedMemberId}/publish`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: { isPublished: false },
    });

    if (unpublishRes.status === 200 && unpublishRes.body.isPublished === false) {
      const publicCheckAfterUnpublish = await apiRequest(`/api/team-members/${unpublishedMemberId}`);
      if (publicCheckAfterUnpublish.status === 404) {
        console.log('✓ 8b. Unpublishing action passed: Admin unpublished member; public access returns 404 again.');
      } else {
        throw new Error('Public can still see member after unpublish');
      }
    } else {
      throw new Error(`Expected 200 for unpublish, got ${unpublishRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Admin Reordering Display Orders
    // -------------------------------------------------------------------------
    const reorderRes = await apiRequest('/api/team-members/reorder', {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: {
        orders: [
          { id: publishedMemberId, displayOrder: 10 },
          { id: member2Res.body.teamMember._id, displayOrder: 5 },
        ],
      },
    });

    if (reorderRes.status === 200 && reorderRes.body.success === true) {
      // Fetch sorted list
      const sortedList = await apiRequest('/api/team-members');
      const firstIdx = sortedList.body.teamMembers.findIndex((m) => m._id === member2Res.body.teamMember._id);
      const secondIdx = sortedList.body.teamMembers.findIndex((m) => m._id === publishedMemberId);
      if (firstIdx !== -1 && secondIdx !== -1 && firstIdx < secondIdx) {
        console.log('✓ 9. Display ordering passed: Reordering endpoint correctly adjusted sorting order (displayOrder 5 precedes 10).');
      } else {
        throw new Error(`Sorting order was not reflected after reorder (firstIdx: ${firstIdx}, secondIdx: ${secondIdx})`);
      }
    } else {
      throw new Error(`Expected 200 for reorder, got ${reorderRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 10: Admin Deletion (DELETE /:id)
    // -------------------------------------------------------------------------
    const deleteRes = await apiRequest(`/api/team-members/${unpublishedMemberId}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });

    if (deleteRes.status === 200 && deleteRes.body.success === true) {
      const checkDeleted = await apiRequest(`/api/team-members/${unpublishedMemberId}`, {
        headers: { 'x-admin-key': adminKey },
      });
      if (checkDeleted.status === 404) {
        console.log('✓ 10. Admin deletion passed: Member was deleted and subsequent lookup returns 404.');
      } else {
        throw new Error('Deleted member still exists in database');
      }
    } else {
      throw new Error(`Expected 200 for delete, got ${deleteRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Alias Endpoints & Method Compatibility under /api/admin/team-members
    // -------------------------------------------------------------------------
    // 11a. Admin GET /api/admin/team-members
    const adminAliasList = await apiRequest('/api/admin/team-members', {
      headers: { 'x-admin-key': adminKey },
    });
    if (adminAliasList.status !== 200 || !Array.isArray(adminAliasList.body.teamMembers)) {
      throw new Error(`Expected 200 for admin alias list, got ${adminAliasList.status}`);
    }
    console.log('✓ 11a. Admin alias routing passed: GET /api/admin/team-members successfully accessible via admin gateway.');

    // 11b. Admin POST /api/admin/team-members (Creation via admin gateway)
    const adminCreateRes = await apiRequest('/api/admin/team-members', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: {
        fullName: 'Admin Gateway Member',
        designation: 'Academic Dean',
        category: 'Leadership',
        isPublished: false,
      },
    });
    if (adminCreateRes.status !== 201 || !adminCreateRes.body.teamMember?._id) {
      throw new Error(`Expected 201 for POST /api/admin/team-members, got ${adminCreateRes.status}`);
    }
    const adminCreatedId = adminCreateRes.body.teamMember._id;
    createdMemberIds.push(adminCreatedId);
    console.log('✓ 11b. Admin creation passed: POST /api/admin/team-members created record successfully.');

    // 11c. Admin POST /api/admin/team-members/:id/publish (POST method on publish route)
    const postPublishRes = await apiRequest(`/api/admin/team-members/${adminCreatedId}/publish`, {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: { isPublished: true },
    });
    if (postPublishRes.status !== 200 || postPublishRes.body.isPublished !== true) {
      throw new Error(`Expected 200 for POST /api/admin/team-members/:id/publish, got ${postPublishRes.status}`);
    }
    console.log('✓ 11c. Method compatibility passed: POST /api/admin/team-members/:id/publish published member.');

    // 11d. Admin POST /api/admin/team-members with { id, isPublished } (Delegation to publish)
    const collectionPublishRes = await apiRequest('/api/admin/team-members', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: { id: adminCreatedId, isPublished: false },
    });
    if (collectionPublishRes.status !== 200 || collectionPublishRes.body.isPublished !== false) {
      throw new Error(`Expected 200 for POST /api/admin/team-members delegation, got ${collectionPublishRes.status}`);
    }
    console.log('✓ 11d. Collection delegation passed: POST /api/admin/team-members with {id, isPublished} unpublished member.');

    // 11e. Admin POST /api/admin/team-members/reorder
    const postReorderRes = await apiRequest('/api/admin/team-members/reorder', {
      method: 'POST',
      headers: { 'x-admin-key': adminKey },
      body: { orders: [{ id: adminCreatedId, displayOrder: 99 }] },
    });
    if (postReorderRes.status !== 200 || postReorderRes.body.success !== true) {
      throw new Error(`Expected 200 for POST /api/admin/team-members/reorder, got ${postReorderRes.status}`);
    }
    console.log('✓ 11e. Method compatibility passed: POST /api/admin/team-members/reorder succeeded.');

    // 11f. Direct route without /api prefix (Fallback resilience)
    const directRouteRes = await apiRequest(`/admin/team-members/${adminCreatedId}`, {
      headers: { 'x-admin-key': adminKey },
    });
    if (directRouteRes.status !== 200 || !directRouteRes.body.teamMember) {
      throw new Error(`Expected 200 for fallback /admin/team-members/:id, got ${directRouteRes.status}`);
    }
    console.log('✓ 11f. Prefix resilience passed: Direct /admin/team-members/:id resolved with 200.');

    // 11g. Cleanup the admin gateway member
    const cleanupAdminMember = await apiRequest(`/api/admin/team-members/${adminCreatedId}`, {
      method: 'DELETE',
      headers: { 'x-admin-key': adminKey },
    });
    if (cleanupAdminMember.status !== 200) {
      throw new Error(`Expected 200 for DELETE /api/admin/team-members/:id, got ${cleanupAdminMember.status}`);
    }
    console.log('✓ 11g. Admin deletion passed: DELETE /api/admin/team-members/:id removed record.');

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await TeamMember.deleteMany({ _id: { $in: createdMemberIds } });
    console.log('✓ 12. Cleaned up test data.');

    console.log('\n====================================================');
    console.log('ALL LEADERSHIP & TEAM MEMBERS TESTS PASSED (12/12)!');
    console.log('====================================================\n');

    if (server) server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    if (createdMemberIds.length > 0) {
      await TeamMember.deleteMany({ _id: { $in: createdMemberIds } }).catch(() => {});
    }
    if (server) server.close();
    process.exit(1);
  }
}

runTests();
