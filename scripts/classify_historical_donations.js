/**
 * Historical Donations Safe Classification Script
 *
 * Safely inspects and classifies historical donation records that lack the `livemode` boolean field.
 *
 * Strict Safety Rules:
 * - Defaults to DRY-RUN mode (zero database writes).
 * - Requires explicit `--execute` flag to apply updates to MongoDB.
 * - Test sessions (`cs_test_...`) are safely classified as `livemode: false`.
 * - Live sessions (`cs_live_...`) are NEVER classified as `livemode: true` based on prefix alone.
 *   They require:
 *     1. Internal record status === 'completed' and paymentStatus === 'paid'.
 *     2. Authenticated Stripe Live API configuration (sk_live_...).
 *     3. Live session retrieval confirming session.livemode === true and session.payment_status === 'paid'.
 *   If any check fails or is unverifiable, the record remains unclassified.
 * - Atomic database updates target only `{ _id, livemode: { $exists: false } }`.
 * - Never prints API keys, secrets, tokens, or donor personal information.
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('../src/config/db');
const Donation = require('../src/models/Donation');
const stripe = require('../src/config/stripe');

/**
 * Safely mask session IDs for privacy and audit logs
 */
function maskSessionId(id) {
  if (!id || typeof id !== 'string') return '[missing-id]';
  const trimmed = id.trim();
  if (trimmed.length <= 12) return trimmed.slice(0, 4) + '***';
  return trimmed.slice(0, 12) + '...';
}

async function runClassification() {
  const isExecute = process.argv.includes('--execute');

  // Verify whether configured Stripe secret key is a Live key without exposing it
  const rawKey = process.env.STRIPE_SECRET_KEY || '';
  const hasLiveSecretKey = typeof rawKey === 'string' && rawKey.startsWith('sk_live_');

  console.log('=================================================================');
  console.log(`HISTORICAL DONATIONS CLASSIFICATION (${isExecute ? 'EXECUTE MODE' : 'DRY RUN'})`);
  console.log(`Stripe Live API Available: ${hasLiveSecretKey ? 'YES (Live Key Configured)' : 'NO (Test/Missing Key)'}`);
  console.log('=================================================================\n');

  try {
    await connectDB();

    // Query strictly for historical records that lack the `livemode` field
    const unclassifiedDonations = await Donation.find({
      livemode: { $exists: false },
    }).lean();

    console.log(`Found ${unclassifiedDonations.length} unclassified donation record(s).\n`);

    if (unclassifiedDonations.length === 0) {
      console.log('No historical records require classification. All records have livemode set.');
      process.exit(0);
    }

    const testCandidates = [];
    const liveCandidates = [];
    const skippedCandidates = [];

    for (const doc of unclassifiedDonations) {
      const sessionId = typeof doc.stripeSessionId === 'string' ? doc.stripeSessionId.trim() : '';
      const maskedId = maskSessionId(sessionId);
      const amountStr = typeof doc.amount === 'number' ? `$${doc.amount.toFixed(2)}` : 'N/A';
      const statusStr = doc.status || 'unknown';
      const paymentStatusStr = doc.paymentStatus || 'unpaid';

      // 1. Stripe Test Mode Sessions
      if (sessionId.startsWith('cs_test_')) {
        testCandidates.push({
          id: doc._id,
          targetLiveMode: false,
          maskedId,
          amountStr,
          statusStr,
          reason: 'Valid cs_test_ prefix confirms Stripe Test Mode origin',
        });
        console.log(
          `• [${doc._id}] Session: ${maskedId} | Status: ${statusStr} | Amount: ${amountStr} -> WOULD CLASSIFY: TEST (livemode: false)`
        );
        continue;
      }

      // 2. Stripe Live Mode Candidates
      if (sessionId.startsWith('cs_live_')) {
        // Guard A: Check internal document status first
        if (doc.status !== 'completed' || doc.paymentStatus !== 'paid') {
          skippedCandidates.push({
            id: doc._id,
            maskedId,
            amountStr,
            statusStr,
            reason: `cs_live_ session is not completed/paid in DB (status: ${statusStr}, paymentStatus: ${paymentStatusStr}); left unclassified`,
          });
          console.log(
            `• [${doc._id}] Session: ${maskedId} | Status: ${statusStr} | Amount: ${amountStr} -> SKIPPED (Unpaid/Incomplete; never auto-classified as Live)`
          );
          continue;
        }

        // Guard B: Require Live Stripe API configuration
        if (!hasLiveSecretKey) {
          skippedCandidates.push({
            id: doc._id,
            maskedId,
            amountStr,
            statusStr,
            reason: 'STRIPE_SECRET_KEY is not a Live key; cannot verify session against Stripe Live API',
          });
          console.log(
            `• [${doc._id}] Session: ${maskedId} | Status: ${statusStr} | Amount: ${amountStr} -> SKIPPED (Live key missing; unverifiable)`
          );
          continue;
        }

        // Guard C: Verify session directly with Stripe Live API
        try {
          const liveSession = await stripe.checkout.sessions.retrieve(sessionId);

          if (liveSession && liveSession.livemode === true && liveSession.payment_status === 'paid') {
            liveCandidates.push({
              id: doc._id,
              targetLiveMode: true,
              maskedId,
              amountStr,
              statusStr,
              reason: 'Verified against Stripe Live API: session exists, livemode is true, and payment_status is paid',
            });
            console.log(
              `• [${doc._id}] Session: ${maskedId} | Status: ${statusStr} | Amount: ${amountStr} -> WOULD CLASSIFY: LIVE (livemode: true)`
            );
          } else {
            skippedCandidates.push({
              id: doc._id,
              maskedId,
              amountStr,
              statusStr,
              reason: `Stripe Live API returned inconclusive state: livemode=${liveSession?.livemode}, payment_status=${liveSession?.payment_status}`,
            });
            console.log(
              `• [${doc._id}] Session: ${maskedId} | Status: ${statusStr} | Amount: ${amountStr} -> SKIPPED (Stripe Live verification inconclusive)`
            );
          }
        } catch (apiError) {
          skippedCandidates.push({
            id: doc._id,
            maskedId,
            amountStr,
            statusStr,
            reason: `Stripe API retrieval failed: ${apiError.message}`,
          });
          console.log(
            `• [${doc._id}] Session: ${maskedId} | Status: ${statusStr} | Amount: ${amountStr} -> SKIPPED (Stripe API error: ${apiError.message})`
          );
        }
        continue;
      }

      // 3. Missing or Unrecognized Session Format
      skippedCandidates.push({
        id: doc._id,
        maskedId,
        amountStr,
        statusStr,
        reason: 'Missing or unrecognized session ID format; left unclassified for safety',
      });
      console.log(
        `• [${doc._id}] Session: ${maskedId} | Status: ${statusStr} | Amount: ${amountStr} -> SKIPPED (Unrecognized format)`
      );
    }

    console.log('\n-----------------------------------------------------------------');
    console.log('Classification Summary:');
    console.log(`- Test Mode candidates (livemode -> false): ${testCandidates.length}`);
    console.log(`- Verified Live candidates (livemode -> true):  ${liveCandidates.length}`);
    console.log(`- Unverifiable / Skipped (remain unclassified): ${skippedCandidates.length}`);
    console.log('-----------------------------------------------------------------\n');

    if (isExecute) {
      console.log('Applying atomic updates to MongoDB...');
      let updatedTest = 0;
      let updatedLive = 0;
      let skippedConcurrent = 0;

      // Update verified Test Mode records
      for (const item of testCandidates) {
        const res = await Donation.updateOne(
          { _id: item.id, livemode: { $exists: false } },
          { $set: { livemode: false } }
        );
        if (res.modifiedCount === 1) {
          updatedTest++;
        } else {
          skippedConcurrent++;
        }
      }

      // Update verified Live Mode records
      for (const item of liveCandidates) {
        const res = await Donation.updateOne(
          { _id: item.id, livemode: { $exists: false } },
          { $set: { livemode: true } }
        );
        if (res.modifiedCount === 1) {
          updatedLive++;
        } else {
          skippedConcurrent++;
        }
      }

      console.log(`✓ Updated ${updatedTest} record(s) to livemode: false (Test Mode).`);
      console.log(`✓ Updated ${updatedLive} record(s) to livemode: true (Live Mode).`);
      if (skippedConcurrent > 0) {
        console.warn(`! Skipped ${skippedConcurrent} record(s) due to concurrent updates or prior classification.`);
      }
      console.log(`ℹ ${skippedCandidates.length} unverifiable/unpaid record(s) remained unclassified.`);
    } else {
      console.log('ℹ DRY RUN complete. Zero database writes were performed.');
      console.log('ℹ To apply verified updates to the database, run:');
      console.log('   node scripts/classify_historical_donations.js --execute\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during classification:', error);
    process.exit(1);
  }
}

runClassification();
