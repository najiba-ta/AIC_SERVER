const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Admission = require('../src/models/Admission');
const Counter = require('../src/models/Counter');
const generateToken = require('../src/utils/generateToken');
const app = require('../server');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING STUDENT ADMISSION BACKEND API VERIFICATION');
  console.log('====================================================\n');

  let server;
  try {
    await connectDB();

    // Start server on random available port
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`✓ Test server running on ${baseUrl}`);

    // Helper for requests
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

    // 1. Create a clean test student user
    const testEmail = `test_student_admission_${Date.now()}@example.com`;
    const testStudent = new User({
      name: 'Ahmed Tariq',
      email: testEmail,
      password: 'password123',
      role: 'student',
      status: 'pending',
    });
    await testStudent.save();
    const studentToken = generateToken(testStudent._id.toString(), 'student');
    console.log('✓ 1. Test student created and authenticated with JWT token.');

    // Create an unauthorized user to test access control
    const otherUser = new User({
      name: 'Other Student',
      email: `other_student_${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
    });
    await otherUser.save();
    const otherUserToken = generateToken(otherUser._id.toString(), 'student');
    console.log('✓ 2. Secondary test student created for security isolation tests.');

    const adminKey = process.env.ADMIN_API_KEY;

    // 3. Test submitting with missing required fields
    const invalidRes = await apiRequest('/api/admissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        fullName: 'Ahmed Tariq',
        // missing required fields: phone, email, guardianName, guardianAgreement, etc.
      },
    });

    if (invalidRes.status === 400 && invalidRes.body.success === false) {
      console.log(`✓ 3. Validation test passed: server rejected incomplete submission with 400 (${invalidRes.body.message})`);
    } else {
      throw new Error(`Expected 400 for invalid submission, got ${invalidRes.status}`);
    }

    // 4. Test valid admission submission
    const validAdmissionData = {
      fullName: 'Ahmed Tariq',
      dateOfBirth: '2012-05-15',
      gender: 'male',
      bloodGroup: 'B+',
      phone: '+1 (555) 234-5678',
      email: testEmail,
      address: '786 Islamic Center Way, Queens, NY 11432',
      city: 'Queens',
      state: 'NY',
      zipCode: '11432',
      country: 'United States',
      schoolOrCollege: 'Queens Middle School',
      currentGrade: '7th Grade',
      guardianName: 'Tariq Rahman',
      relationship: 'Father',
      guardianPhone: '+1 (555) 987-6543',
      guardianEmail: 'tariq.rahman@example.com',
      guardianOccupation: 'Engineer',
      emergencyContact: {
        name: 'Fatima Rahman',
        relationship: 'Mother',
        phone: '+1 (555) 876-5432',
      },
      program: 'Comprehensive Islamic Education Program',
      classType: 'In-Person',
      quranLevel: 'Nazra (Fluent Reading)',
      preferredDays: ['Monday', 'Wednesday', 'Friday'],
      preferredTimeSlot: 'Afternoon (4:30 PM - 6:30 PM)',
      previousExperience: 'Attended weekend maktab for 2 years',
      previousInstitute: 'Al-Nur Islamic Academy',
      previousTeacher: 'Ustadh Bilal',
      yearsOfStudy: '2 Years',
      learningNeeds: 'None',
      additionalNotes: 'Enthusiastic to memorize Juz Amma this academic term.',
      guardianAgreement: true,
      signature: 'Tariq Rahman',
    };

    const submitRes = await apiRequest('/api/admissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: validAdmissionData,
    });

    if (submitRes.status === 201 && submitRes.body.success === true && submitRes.body.application) {
      console.log(`✓ 4. Valid admission submitted successfully (ID: ${submitRes.body.application._id}, Status: ${submitRes.body.application.status})`);
    } else {
      throw new Error(`Expected 201 for valid admission submission, got ${submitRes.status}: ${JSON.stringify(submitRes.body)}`);
    }

    const createdApplicationId = submitRes.body.application._id;

    // 5. Test preventing duplicate active admission submission
    const duplicateRes = await apiRequest('/api/admissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: validAdmissionData,
    });

    if (duplicateRes.status === 400 && duplicateRes.body.success === false && duplicateRes.body.message.includes('already have an admission application pending review')) {
      console.log('✓ 5. Duplicate prevention test passed: blocked second submission while first is pending review.');
    } else {
      throw new Error(`Expected 400 duplicate prevention, got ${duplicateRes.status}: ${JSON.stringify(duplicateRes.body)}`);
    }

    // 6. Test student retrieving own application via /api/admissions/my-application
    const myAppRes = await apiRequest('/api/admissions/my-application', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    if (myAppRes.status === 200 && myAppRes.body.hasApplication === true && myAppRes.body.application._id === createdApplicationId) {
      console.log('✓ 6. Student successfully retrieved own application & status (hasApplication: true, status: pending).');
    } else {
      throw new Error(`Expected 200 for my-application, got ${myAppRes.status}: ${JSON.stringify(myAppRes.body)}`);
    }

    // 7. Security: Test other student attempting to view Ahmed's application
    const unauthorizedViewRes = await apiRequest(`/api/admissions/${createdApplicationId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${otherUserToken}` },
    });

    if (unauthorizedViewRes.status === 403) {
      console.log('✓ 7. Security test passed: foreign student blocked with 403 Forbidden from viewing another student’s application.');
    } else {
      throw new Error(`Expected 403 Forbidden for foreign student, got ${unauthorizedViewRes.status}`);
    }

    // 8. Security: Student attempting to approve or edit office-use
    const studentApproveAttempt = await apiRequest(`/api/admin/admissions/${createdApplicationId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {},
    });

    if (studentApproveAttempt.status === 401 || studentApproveAttempt.status === 403) {
      console.log('✓ 8. Security test passed: student cannot access admin approve route.');
    } else {
      throw new Error(`Expected 401/403 for student accessing admin approve, got ${studentApproveAttempt.status}`);
    }

    // 9. Admin listing all applications with filters & pagination
    const adminListRes = await apiRequest('/api/admin/admissions?status=pending&page=1&limit=10', {
      method: 'GET',
      headers: { 'x-admin-key': adminKey },
    });

    if (adminListRes.status === 200 && adminListRes.body.success === true && Array.isArray(adminListRes.body.applications)) {
      console.log(`✓ 9. Admin retrieved admission applications (Total counts: ${JSON.stringify(adminListRes.body.counts)}).`);
    } else {
      throw new Error(`Expected 200 for admin listing admissions, got ${adminListRes.status}`);
    }

    // 10. Admin viewing specific application details
    const adminGetDetailRes = await apiRequest(`/api/admin/admissions/${createdApplicationId}`, {
      method: 'GET',
      headers: { 'x-admin-key': adminKey },
    });

    if (adminGetDetailRes.status === 200 && adminGetDetailRes.body.application) {
      console.log(`✓ 10. Admin successfully viewed complete application details for ${adminGetDetailRes.body.application.fullName}.`);
    } else {
      throw new Error(`Expected 200 for admin get by ID, got ${adminGetDetailRes.status}`);
    }

    // 11. Admin updating Office-Use information
    const officeUseUpdateRes = await apiRequest(`/api/admin/admissions/${createdApplicationId}/office-use`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: {
        assignedTeacher: 'Sheikh Abdullah',
        monthlyFee: 120,
        classLevel: 'Intermediate Tajweed Level 2',
        startDate: '2026-10-15',
        officeNotes: 'Student tested proficient in basic Qaida and Juz 30 recitation.',
      },
    });

    if (officeUseUpdateRes.status === 200 && officeUseUpdateRes.body.officeUse.monthlyFee === 120) {
      console.log('✓ 11. Admin successfully added/updated office-use information (Teacher, Fee, Level, Notes).');
    } else {
      throw new Error(`Expected 200 for office-use update, got ${officeUseUpdateRes.status}`);
    }

    // 12. Test Admin Rejection with reason
    const rejectRes = await apiRequest(`/api/admin/admissions/${createdApplicationId}/reject`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: {
        reason: 'Selected schedule is at maximum capacity. Please re-apply with alternate timing.',
      },
    });

    if (rejectRes.status === 200 && rejectRes.body.application.status === 'rejected') {
      const studentUserCheck = await User.findById(testStudent._id);
      if (studentUserCheck.status === 'rejected') {
        console.log(`✓ 12. Admin rejected application with reason. Both application and student account status updated to rejected.`);
      } else {
        throw new Error('Student user status was not updated to rejected');
      }
    } else {
      throw new Error(`Expected 200 for rejection, got ${rejectRes.status}`);
    }

    // 13. Test student re-applying after rejection
    const reapplyRes = await apiRequest('/api/admissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: {
        ...validAdmissionData,
        preferredTimeSlot: 'Weekend Morning (9:00 AM - 11:30 AM)',
        additionalNotes: 'Updated preferred time slot to weekend morning as discussed.',
      },
    });

    if (reapplyRes.status === 201 && reapplyRes.body.application.status === 'pending') {
      console.log(`✓ 13. Re-application test passed: student successfully submitted new application (ID: ${reapplyRes.body.application._id}) after prior rejection.`);
    } else {
      throw new Error(`Expected 201 for re-application, got ${reapplyRes.status}`);
    }

    const reapplyAppId = reapplyRes.body.application._id;

    // 14. Test Admin Approval with office-use details & sequential Student ID generation
    const approveRes = await apiRequest(`/api/admin/admissions/${reapplyAppId}/approve`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: {
        assignedTeacher: 'Ustadh Tariq',
        monthlyFee: 100,
        classLevel: 'Weekend Islamic Studies Level 1',
        startDate: '2026-10-18',
        officeNotes: 'Approved for weekend cohort with full registration completed.',
      },
    });

    if (approveRes.status === 200 && approveRes.body.application.status === 'approved') {
      const assignedId = approveRes.body.application.officeUse.studentId;
      console.log(`✓ 14. Admin approval test passed: application approved, assigned Student ID: ${assignedId}.`);

      const approvedUser = await User.findById(testStudent._id);
      if (
        approvedUser.status === 'approved' &&
        approvedUser.isVerified === true &&
        approvedUser.memberId === assignedId
      ) {
        console.log(`✓ 15. Student account verification test passed: User account updated to approved, isVerified=true, memberId=${approvedUser.memberId}.`);
      } else {
        throw new Error('Student User account was not properly updated on approval');
      }
    } else {
      throw new Error(`Expected 200 for approval, got ${approveRes.status}: ${JSON.stringify(approveRes.body)}`);
    }

    // 16. Test duplicate prevention after approval
    const duplicateApprovedRes = await apiRequest('/api/admissions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: validAdmissionData,
    });

    if (duplicateApprovedRes.status === 400 && duplicateApprovedRes.body.message.includes('already been admitted')) {
      console.log('✓ 16. Duplicate prevention test passed: blocked submission for already admitted/approved student.');
    } else {
      throw new Error(`Expected 400 for already approved student, got ${duplicateApprovedRes.status}`);
    }

    // Clean up test documents
    await Admission.deleteMany({ student: { $in: [testStudent._id, otherUser._id] } });
    await User.deleteMany({ _id: { $in: [testStudent._id, otherUser._id] } });
    console.log('✓ 17. Cleaned up test data.');

    console.log('\n====================================================');
    console.log('ALL STUDENT ADMISSION BACKEND TESTS PASSED (17/17)!');
    console.log('====================================================');

    if (server) server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
    if (server) server.close();
    process.exit(1);
  }
}

runTests();
