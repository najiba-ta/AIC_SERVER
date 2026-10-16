const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

// Ensure test mode
process.env.NODE_ENV = 'test';

const connectDB = require('../src/config/db');
const ContactMessage = require('../src/models/ContactMessage');
const { getDestinationEmail } = require('../src/utils/emailService');
const app = require('../server');

async function runTests() {
  console.log('====================================================');
  console.log('STARTING CONTACT FORM & EMAIL DELIVERY API TESTS');
  console.log('====================================================\n');

  let server;
  const createdMessageIds = [];

  try {
    await connectDB();
    await ContactMessage.deleteMany({ email: { $regex: /test.*@example\.com|bot@spam\.com/i } });

    // Start server on an ephemeral port
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;
    console.log(`✓ Test server running on ${baseUrl}`);

    // Helper for API requests
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
    // TEST 1: Destination Email Verification
    // -------------------------------------------------------------------------
    const destination = getDestinationEmail();
    if (destination === 'alhidayahislamiccenter26@gmail.com') {
      console.log(`✓ 1. Destination email verified: ${destination}`);
    } else {
      throw new Error(`Expected alhidayahislamiccenter26@gmail.com, got ${destination}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Validation - Required Fields and Length Checks
    // -------------------------------------------------------------------------
    // 2a. Missing name
    const missingNameRes = await apiRequest('/api/contact', {
      method: 'POST',
      body: {
        email: 'visitor@example.com',
        subject: 'General Inquiry',
        message: 'Hello Al Hidayah Islamic Center',
      },
    });
    if (missingNameRes.status === 400 && missingNameRes.body.message.includes('Name is required')) {
      console.log('✓ 2a. Validation passed: Missing name rejected with 400.');
    } else {
      throw new Error(`Expected 400 for missing name, got ${missingNameRes.status}`);
    }

    // 2b. Name too short
    const shortNameRes = await apiRequest('/api/contact', {
      method: 'POST',
      body: {
        name: 'A',
        message: 'Hello there center',
      },
    });
    if (shortNameRes.status === 400) {
      console.log('✓ 2b. Validation passed: Single character name rejected with 400.');
    } else {
      throw new Error(`Expected 400 for short name, got ${shortNameRes.status}`);
    }

    // 2c. Missing message
    const missingMsgRes = await apiRequest('/api/contact', {
      method: 'POST',
      body: {
        name: 'Brother Ali',
      },
    });
    if (missingMsgRes.status === 400 && missingMsgRes.body.message.includes('Message is required')) {
      console.log('✓ 2c. Validation passed: Missing message rejected with 400.');
    } else {
      throw new Error(`Expected 400 for missing message, got ${missingMsgRes.status}`);
    }

    // 2d. Short message
    const shortMsgRes = await apiRequest('/api/contact', {
      method: 'POST',
      body: {
        name: 'Brother Ali',
        message: 'Hi',
      },
    });
    if (shortMsgRes.status === 400 && shortMsgRes.body.message.includes('Message is required')) {
      console.log('✓ 2d. Validation passed: Short message (< 5 chars) rejected with 400.');
    } else {
      throw new Error(`Expected 400 for short message, got ${shortMsgRes.status}`);
    }

    // 2e. Invalid email format (when email IS provided, it must be valid)
    const invalidEmailRes = await apiRequest('/api/contact', {
      method: 'POST',
      body: {
        name: 'Brother Ali',
        email: 'not-an-email',
        message: 'Hello there center',
      },
    });
    if (invalidEmailRes.status === 400 && invalidEmailRes.body.message.includes('valid email')) {
      console.log('✓ 2e. Validation passed: Invalid email format (when provided) rejected with 400.');
    } else {
      throw new Error(`Expected 400 for invalid email, got ${invalidEmailRes.status}`);
    }

    // 2f. Submission with ONLY name and message (NO email, NO subject) - MUST SUCCEED!
    const nameAndMessageOnlyRes = await apiRequest('/api/contact', {
      method: 'POST',
      body: {
        name: 'Sister Aisha',
        message: 'Assalamu Alaikum. Could you please share the prayer schedule for Eid?',
      },
    });
    if (nameAndMessageOnlyRes.status === 200 && nameAndMessageOnlyRes.body.success === true) {
      console.log('✓ 2f. Exact requirement verified: Submission with ONLY name and message succeeded with 200 OK.');
      if (nameAndMessageOnlyRes.body.data?.id) createdMessageIds.push(nameAndMessageOnlyRes.body.data.id);
    } else {
      throw new Error(`Expected 200 for name-and-message-only submission, got ${nameAndMessageOnlyRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Anti-Spam Honeypot Protection
    // -------------------------------------------------------------------------
    const spamRes = await apiRequest('/api/contact', {
      method: 'POST',
      body: {
        name: 'Spam Bot',
        email: 'bot@spam.com',
        subject: 'Buy Cheap Watches',
        message: 'Click this link immediately!',
        _gotcha: 'bot_filled_value',
      },
    });
    if (spamRes.status === 200 && spamRes.body.success === true) {
      console.log('✓ 3. Anti-spam passed: Honeypot submission silently swallowed with 200 (no spam sent).');
    } else {
      throw new Error(`Expected 200 for honeypot, got ${spamRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Successful Public Contact Form Submission & Email Delivery
    // -------------------------------------------------------------------------
    const validSubmission = await apiRequest('/api/contact', {
      method: 'POST',
      body: {
        name: 'Brother Zaid Rahman',
        email: 'zaid.test@example.com',
        subject: 'Question regarding Jummah prayer times and weekend school',
        message: 'Assalamu Alaikum. Could you please confirm if registration is still open for the junior weekend Islamic school?',
      },
    });

    if (validSubmission.status === 200 && validSubmission.body.success === true) {
      console.log('✓ 4a. Public submission passed: POST /api/contact returned 200 OK.');
      const recordId = validSubmission.body.data?.id;
      if (recordId) createdMessageIds.push(recordId);

      // Verify database record
      const dbRecord = await ContactMessage.findById(recordId);
      if (dbRecord && dbRecord.isDelivered === true && dbRecord.name === 'Brother Zaid Rahman') {
        console.log(`✓ 4b. Persistence & Delivery verified: DB record marked isDelivered: true, recipient: ${destination}.`);
      } else {
        throw new Error('Database record was not properly marked as delivered');
      }
    } else {
      throw new Error(`Expected 200 for valid contact submission, got ${validSubmission.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Fallback Prefix Resilience (POST /contact without /api prefix)
    // -------------------------------------------------------------------------
    const fallbackRes = await apiRequest('/contact', {
      method: 'POST',
      body: {
        name: 'Sister Fatima',
        email: 'fatima.test@example.com',
        subject: 'Donation inquiry',
        message: 'Assalamu Alaikum. How can I set up a monthly recurring contribution for the mosque facility fund?',
      },
    });

    if (fallbackRes.status === 200 && fallbackRes.body.success === true) {
      console.log('✓ 5. Prefix resilience passed: POST /contact resolved cleanly via fallback.');
      if (fallbackRes.body.data?.id) createdMessageIds.push(fallbackRes.body.data.id);
    } else {
      throw new Error(`Expected 200 for fallback /contact, got ${fallbackRes.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Admin Security - Audit Logs Require Authentication
    // -------------------------------------------------------------------------
    const unauthAudit = await apiRequest('/api/contact/messages');
    if (unauthAudit.status === 401) {
      console.log('✓ 6a. Security verified: Unauthenticated GET /api/contact/messages rejected with 401.');
    } else {
      throw new Error(`Expected 401 for unauthenticated audit list, got ${unauthAudit.status}`);
    }

    const authAudit = await apiRequest('/api/contact/messages', {
      headers: { 'x-admin-key': adminKey },
    });
    if (authAudit.status === 200 && Array.isArray(authAudit.body.messages)) {
      console.log(`✓ 6b. Admin audit passed: Authorized admin retrieved contact messages (Count: ${authAudit.body.count}).`);
    } else {
      throw new Error(`Expected 200 for admin audit list, got ${authAudit.status}`);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Admin Gateway Alias (GET /api/admin/contact-messages)
    // -------------------------------------------------------------------------
    const adminGatewayAudit = await apiRequest('/api/admin/contact-messages', {
      headers: { 'x-admin-key': adminKey },
    });
    if (adminGatewayAudit.status === 200 && Array.isArray(adminGatewayAudit.body.messages)) {
      console.log('✓ 7. Admin gateway alias passed: /api/admin/contact-messages retrieved messages.');
    } else {
      throw new Error(`Expected 200 for /api/admin/contact-messages, got ${adminGatewayAudit.status}`);
    }

    // -------------------------------------------------------------------------
    // CLEANUP
    // -------------------------------------------------------------------------
    await ContactMessage.deleteMany({ _id: { $in: createdMessageIds } });
    console.log('✓ 8. Cleaned up test messages.');

    console.log('\n====================================================');
    console.log('ALL CONTACT FORM & EMAIL DELIVERY TESTS PASSED (8/8)!');
    console.log('====================================================\n');

    if (server) server.close();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ CONTACT API TEST SUITE FAILED:', err);
    if (createdMessageIds.length > 0) {
      await ContactMessage.deleteMany({ _id: { $in: createdMessageIds } }).catch(() => {});
    }
    if (server) server.close();
    process.exit(1);
  }
}

runTests();
