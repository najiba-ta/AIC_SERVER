const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const TeacherApplication = require('../src/models/TeacherApplication');
const Counter = require('../src/models/Counter');
const generateToken = require('../src/utils/generateToken');
const app = require('../server');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING TEACHER APPLICATION BACKEND API REGRESSION TESTS');
  console.log('====================================================\n');

  let server;
  const createdUserIds = [];
  const createdApplicationIds = [];

  try {
    await connectDB();

    // Start server on a random port for tests
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
    // TEST 1: Teacher Authentication
    // -------------------------------------------------------------------------
    const testTeacherEmail = `test_teacher_${Date.now()}@example.com`;
    const testTeacher = new User({
      name: 'Ustadh Bilal Mansoor',
      email: testTeacherEmail,
      password: 'password123',
      role: 'teacher',
      status: 'pending',
    });
    await testTeacher.save();
    createdUserIds.push(testTeacher._id);
    const teacherToken = generateToken(testTeacher._id.toString(), 'teacher');
    console.log('✓ 1. Teacher created and authenticated with JWT token.');

    // -------------------------------------------------------------------------
    // TEST 2: Validation of required fields
    // -------------------------------------------------------------------------
    const invalidSubmissionRes = await apiRequest('/api/teacher-applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: {
        fullName: 'Ustadh Bilal Mansoor',
        // Missing required fields: position, address, phone, dateOfBirth, citizenship, emergencyContact, subjects, etc.
      },
    });

    if (invalidSubmissionRes.status === 400 && invalidSubmissionRes.body.success === false) {
      console.log(
        `✓ 2. Validation test passed: server rejected incomplete submission with 400 (${invalidSubmissionRes.body.message})`
      );
    } else {
      throw new Error(`Expected 400 for invalid submission, got ${invalidSubmissionRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Valid Teacher Application Submission
    // -------------------------------------------------------------------------
    const validApplicationData = {
      applicationDate: '2026-10-06',
      position: 'Quran & Islamic Studies Instructor',
      fullName: 'Ustadh Bilal Mansoor',
      fatherOrSpouseName: 'Mansoor Ali',
      address: '123 Islamic Center Way, Queens, NY 11432',
      phone: '+1 (555) 765-4321',
      email: testTeacherEmail,
      dateOfBirth: '1988-04-12',
      citizenship: 'US Citizen',
      emergencyContact: {
        name: 'Amina Mansoor',
        phone: '+1 (555) 321-4321',
      },
      educationQualifications: [
        {
          degreeCertificate: 'Bachelor of Islamic Studies',
          institution: 'Al-Azhar University',
          subject: 'Shariah & Quranic Sciences',
          year: '2010',
        },
        {
          degreeCertificate: 'Masters in Education',
          institution: 'Queens College CUNY',
          subject: 'Educational Leadership',
          year: '2014',
        },
      ],
      quranTajweedHifzQualifications: 'Hafiz of the Holy Quran with continuous chain of transmission',
      ijazahOrCertification: 'Ijazah in Hafs ‘an ‘Asim and Warsh recitation',
      teachingExperience: [
        {
          institution: 'Darul Uloom Academy',
          position: 'Senior Quran & Tajweed Instructor',
          subjectOrClass: 'Hifz Program & Adult Tajweed',
          dates: '2015 - 2023',
        },
      ],
      subjects: ['Quran', 'Tajweed', 'Hifz', 'Islamic Studies', 'Arabic'],
      otherSubject: 'Tafseer',
      levels: ['Children', 'Teens', 'Adults', 'Beginner', 'Intermediate', 'Advanced'],
      languages: ['Bangla', 'English', 'Arabic', 'Urdu'],
      otherLanguage: '',
      employmentType: 'Full-time',
      availability: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        time: '3:00 PM - 8:30 PM',
      },
      startDate: '2026-11-01',
      references: [
        {
          name: 'Dr. Mahmoud Farouk',
          relation: 'Former Academic Director',
          organization: 'Islamic Institute of New York',
          phone: '+1 (555) 654-9870',
        },
        {
          name: 'Sheikh Ahmad Nur',
          relation: 'Senior Scholar',
          organization: 'Muslim Community Center',
          phone: '+1 (555) 432-8765',
        },
      ],
      applicantAgreement: true,
      signature: 'Bilal Mansoor',
      signatureDate: '2026-10-06',
    };

    const submitRes = await apiRequest('/api/teacher-applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: validApplicationData,
    });

    if (submitRes.status === 201 && submitRes.body.success === true && submitRes.body.application) {
      console.log(
        `✓ 3. Valid teacher application submitted successfully (ID: ${submitRes.body.application._id}, Status: ${submitRes.body.application.status})`
      );
    } else {
      throw new Error(
        `Expected 201 for valid application submission, got ${submitRes.status}: ${JSON.stringify(submitRes.body)}`
      );
    }

    const firstApplicationId = submitRes.body.application._id;
    createdApplicationIds.push(firstApplicationId);

    // -------------------------------------------------------------------------
    // TEST 4: Duplicate Prevention While Pending
    // -------------------------------------------------------------------------
    const duplicateRes = await apiRequest('/api/teacher-applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: validApplicationData,
    });

    if (
      duplicateRes.status === 400 &&
      duplicateRes.body.success === false &&
      duplicateRes.body.message.includes('already have a teacher employment application pending review')
    ) {
      console.log('✓ 4. Duplicate prevention test passed: blocked second submission while first application is pending review.');
    } else {
      throw new Error(`Expected 400 duplicate prevention, got ${duplicateRes.status}: ${JSON.stringify(duplicateRes.body)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Teacher Retrieving Own Application
    // -------------------------------------------------------------------------
    const myAppRes1 = await apiRequest('/api/teacher-applications/my-application', {
      method: 'GET',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    const myAppRes2 = await apiRequest('/api/teacher-applications/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });

    if (
      myAppRes1.status === 200 &&
      myAppRes1.body.hasApplication === true &&
      myAppRes1.body.application._id === firstApplicationId &&
      myAppRes2.status === 200 &&
      myAppRes2.body.hasApplication === true
    ) {
      console.log('✓ 5. Teacher successfully retrieved own application via both /my-application and /me endpoints.');
    } else {
      throw new Error(`Expected 200 for my-application, got ${myAppRes1.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Teacher Cannot Access Another Teacher's Application
    // -------------------------------------------------------------------------
    const secondTeacher = new User({
      name: 'Ustadh Tariq Aziz',
      email: `teacher2_${Date.now()}@example.com`,
      password: 'password123',
      role: 'teacher',
      status: 'pending',
    });
    await secondTeacher.save();
    createdUserIds.push(secondTeacher._id);
    const secondTeacherToken = generateToken(secondTeacher._id.toString(), 'teacher');

    const unauthorizedAccessRes = await apiRequest(`/api/teacher-applications/${firstApplicationId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${secondTeacherToken}` },
    });

    if (unauthorizedAccessRes.status === 403) {
      console.log('✓ 6. Security isolation passed: teacher cannot view another teacher’s employment application (403 Forbidden).');
    } else {
      throw new Error(`Expected 403 for foreign teacher access, got ${unauthorizedAccessRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Student Cannot Submit Teacher Application
    // -------------------------------------------------------------------------
    const testStudent = new User({
      name: 'Samir Student',
      email: `student_test_${Date.now()}@example.com`,
      password: 'password123',
      role: 'student',
      status: 'pending',
    });
    await testStudent.save();
    createdUserIds.push(testStudent._id);
    const studentToken = generateToken(testStudent._id.toString(), 'student');

    const studentSubmitAttempt = await apiRequest('/api/teacher-applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: validApplicationData,
    });

    if (studentSubmitAttempt.status === 403 && studentSubmitAttempt.body.message.includes('Only registered teachers')) {
      console.log('✓ 7. Role separation passed: students are blocked with 403 from submitting Teacher Applications.');
    } else {
      throw new Error(`Expected 403 for student submit attempt, got ${studentSubmitAttempt.status}: ${JSON.stringify(studentSubmitAttempt.body)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Student Cannot Access Teacher Application
    // -------------------------------------------------------------------------
    const studentAccessAttempt = await apiRequest(`/api/teacher-applications/${firstApplicationId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const studentMeAttempt = await apiRequest('/api/teacher-applications/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    if (studentAccessAttempt.status === 403 && studentMeAttempt.status === 403) {
      console.log('✓ 8. Role separation passed: students cannot access teacher application endpoints (403 Forbidden).');
    } else {
      throw new Error(`Expected 403 for student accessing teacher endpoints, got ${studentAccessAttempt.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Admin Listing Applications with Filters, Search, and Counts
    // -------------------------------------------------------------------------
    const adminListRes = await apiRequest('/api/admin/teacher-applications?status=pending&page=1&limit=10', {
      method: 'GET',
      headers: { 'x-admin-key': adminKey },
    });

    if (
      adminListRes.status === 200 &&
      adminListRes.body.success === true &&
      Array.isArray(adminListRes.body.applications) &&
      adminListRes.body.counts &&
      typeof adminListRes.body.counts.pending === 'number'
    ) {
      console.log(
        `✓ 9. Admin listing passed: returned applications with status filter and counts (Pending: ${adminListRes.body.counts.pending}, Total: ${adminListRes.body.counts.total}).`
      );
    } else {
      throw new Error(`Expected 200 for admin listing, got ${adminListRes.status}`);
    }

    // Test search filter
    const adminSearchRes = await apiRequest('/api/admin/teacher-applications?search=Bilal', {
      method: 'GET',
      headers: { 'x-admin-key': adminKey },
    });

    if (
      adminSearchRes.status === 200 &&
      adminSearchRes.body.applications.some((app) => app.fullName.includes('Bilal'))
    ) {
      console.log('✓ 9b. Admin search by teacher name returned matching records.');
    } else {
      throw new Error('Admin search filter failed');
    }

    // -------------------------------------------------------------------------
    // TEST 10: Admin Viewing Complete Application Details
    // -------------------------------------------------------------------------
    const adminDetailRes = await apiRequest(`/api/admin/teacher-applications/${firstApplicationId}`, {
      method: 'GET',
      headers: { 'x-admin-key': adminKey },
    });

    if (
      adminDetailRes.status === 200 &&
      adminDetailRes.body.application &&
      adminDetailRes.body.application.educationQualifications?.length > 0 &&
      adminDetailRes.body.application.teachingExperience?.length > 0 &&
      adminDetailRes.body.application.references?.length > 0
    ) {
      console.log('✓ 10. Admin successfully viewed complete submitted application form (Personal, Education, Experience, Skills, References).');
    } else {
      throw new Error(`Expected complete application detail, got ${adminDetailRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 11: Admin Rejection with Reason
    // -------------------------------------------------------------------------
    const rejectionReason = 'Current opening filled for full-time. We are currently prioritizing weekend substitutes.';
    const rejectRes = await apiRequest(`/api/admin/teacher-applications/${firstApplicationId}/reject`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: { reason: rejectionReason },
    });

    if (
      rejectRes.status === 200 &&
      rejectRes.body.application.status === 'rejected' &&
      rejectRes.body.application.rejectionReason === rejectionReason
    ) {
      const teacherUserCheck = await User.findById(testTeacher._id);
      if (teacherUserCheck.status === 'rejected') {
        console.log('✓ 11. Admin rejection passed: Application and teacher user account both updated to rejected with reason.');
      } else {
        throw new Error('Teacher User status was not updated to rejected');
      }
    } else {
      throw new Error(`Expected 200 for rejection, got ${rejectRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 12: Rejected Teacher Can Re-apply
    // -------------------------------------------------------------------------
    const reapplyData = {
      ...validApplicationData,
      employmentType: 'Weekend',
      availability: {
        days: ['Saturday', 'Sunday'],
        time: '9:00 AM - 1:00 PM',
      },
    };

    const reapplyRes = await apiRequest('/api/teacher-applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: reapplyData,
    });

    if (reapplyRes.status === 201 && reapplyRes.body.application.status === 'pending') {
      console.log(`✓ 12. Re-application test passed: teacher successfully submitted new application (ID: ${reapplyRes.body.application._id}) after prior rejection.`);
    } else {
      throw new Error(`Expected 201 for re-application, got ${reapplyRes.status}: ${JSON.stringify(reapplyRes.body)}`);
    }

    const reapplyApplicationId = reapplyRes.body.application._id;
    createdApplicationIds.push(reapplyApplicationId);

    // -------------------------------------------------------------------------
    // TEST 13 & 14: Admin Approval & Teacher ID Generation
    // -------------------------------------------------------------------------
    const approveRes = await apiRequest(`/api/admin/teacher-applications/${reapplyApplicationId}/approve`, {
      method: 'PATCH',
      headers: { 'x-admin-key': adminKey },
      body: {},
    });

    if (approveRes.status === 200 && approveRes.body.application.status === 'approved') {
      const generatedTeacherId = approveRes.body.application.teacherId;
      console.log(`✓ 13. Admin approval passed: application marked as approved.`);

      if (/^AIC-TEA-\d{3,}$/.test(generatedTeacherId)) {
        console.log(`✓ 14. Teacher ID generation passed: Assigned sequential ID: ${generatedTeacherId}.`);
      } else {
        throw new Error(`Invalid Teacher ID format: ${generatedTeacherId}`);
      }

      // -------------------------------------------------------------------------
      // TEST 15: User Account Becomes Approved & Verified
      // -------------------------------------------------------------------------
      const approvedTeacherUser = await User.findById(testTeacher._id);
      if (
        approvedTeacherUser.status === 'approved' &&
        approvedTeacherUser.isVerified === true &&
        approvedTeacherUser.memberId === generatedTeacherId &&
        approvedTeacherUser.role === 'teacher'
      ) {
        console.log(
          `✓ 15. User synchronization passed: User account status=approved, isVerified=true, memberId=${approvedTeacherUser.memberId}, role=teacher.`
        );
      } else {
        throw new Error(
          `User synchronization failed: status=${approvedTeacherUser?.status}, isVerified=${approvedTeacherUser?.isVerified}, memberId=${approvedTeacherUser?.memberId}`
        );
      }
    } else {
      throw new Error(`Expected 200 for approval, got ${approveRes.status}: ${JSON.stringify(approveRes.body)}`);
    }

    // -------------------------------------------------------------------------
    // TEST 16: Duplicate Submission Blocked After Approval
    // -------------------------------------------------------------------------
    const duplicateApprovedRes = await apiRequest('/api/teacher-applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${teacherToken}` },
      body: validApplicationData,
    });

    if (
      duplicateApprovedRes.status === 400 &&
      duplicateApprovedRes.body.message.includes('already have an approved teacher application')
    ) {
      console.log('✓ 16. Duplicate prevention test passed: blocked submission for already approved teacher.');
    } else {
      throw new Error(
        `Expected 400 for duplicate submission after approval, got ${duplicateApprovedRes.status}: ${JSON.stringify(duplicateApprovedRes.body)}`
      );
    }

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await TeacherApplication.deleteMany({ _id: { $in: createdApplicationIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
    console.log('✓ 17. Cleaned up test data.');

    console.log('\n====================================================');
    console.log('ALL TEACHER APPLICATION TESTS PASSED SUCCESSFULLY (17/17)!');
    console.log('====================================================');

    if (server) server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err);
    if (createdApplicationIds.length > 0) {
      await TeacherApplication.deleteMany({ _id: { $in: createdApplicationIds } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } }).catch(() => {});
    }
    if (server) server.close();
    process.exit(1);
  }
}

runTests();
