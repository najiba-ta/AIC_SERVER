const stripe = require('../config/stripe');
const Donation = require('../models/Donation');
const ProcessedEvent = require('../models/ProcessedEvent');

/**
 * @desc    Create a Stripe Checkout Session for a donation
 * @route   POST /api/stripe/checkout
 * @access  Public
 */
const createCheckoutSession = async (req, res, next) => {
  try {
    const { amount, category, donorName, donorEmail, message } = req.body;

    // Server-side validation
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || !isFinite(parsedAmount) || parsedAmount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid donation amount. The minimum donation is $1.00 USD.',
      });
    }

    if (parsedAmount > 100000) {
      return res.status(400).json({
        success: false,
        message: 'Donation amount exceeds the maximum single transaction limit ($100,000 USD).',
      });
    }

    // Stripe expects amounts in the smallest currency unit (cents for USD)
    const amountInCents = Math.round(parsedAmount * 100);

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    const donationCategory = category && typeof category === 'string' ? category.trim() : 'General Donation';

    // Build Stripe Checkout Session
    const sessionConfig = {
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Al Hidayah Islamic Center Donation',
              description: `Contribution for ${donationCategory}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${clientUrl}/donate/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/donate/cancel`,
      metadata: {
        category: donationCategory,
        donorName: donorName ? String(donorName).trim() : 'Anonymous',
        donorEmail: donorEmail ? String(donorEmail).trim() : '',
        message: message ? String(message).trim() : '',
      },
    };

    // Include customer email if provided and valid
    if (donorEmail && typeof donorEmail === 'string' && donorEmail.includes('@')) {
      sessionConfig.customer_email = donorEmail.trim();
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // Create a pending donation record in MongoDB
    await Donation.create({
      stripeSessionId: session.id,
      amount: parsedAmount,
      amountInCents,
      currency: 'usd',
      status: 'pending',
      paymentStatus: 'unpaid',
      donorName: donorName ? String(donorName).trim() : 'Anonymous',
      donorEmail: donorEmail ? String(donorEmail).trim() : undefined,
      category: donationCategory,
      message: message ? String(message).trim() : undefined,
      metadata: {
        stripeSessionUrl: session.url,
      },
    });

    return res.status(200).json({
      success: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error('[Stripe Checkout Error]:', error);
    next(error);
  }
};

/**
 * @desc    Handle Stripe Webhooks with signature verification & idempotency
 * @route   POST /api/stripe/webhook
 * @access  Public (Webhook signature verified)
 */
const handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[Webhook Error] Missing Stripe signature or STRIPE_WEBHOOK_SECRET');
    return res.status(400).json({
      success: false,
      message: 'Webhook signature or secret missing',
    });
  }

  let event;

  try {
    // req.body must be the raw Buffer
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`[Webhook Verification Error]: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Duplicate-event protection (Idempotency)
  try {
    const existingEvent = await ProcessedEvent.findOne({ eventId: event.id });
    if (existingEvent) {
      console.log(`[Webhook] Duplicate event ignored: ${event.id} (${event.type})`);
      return res.status(200).json({ received: true, duplicate: true });
    }
  } catch (dbErr) {
    console.error('[Webhook DB Error] Checking processed event:', dbErr);
    return res.status(500).json({ error: 'Database error checking event idempotency' });
  }

  try {
    // Handle specific event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        if (session.payment_status === 'paid') {
          const donorEmail =
            session.customer_details?.email ||
            session.customer_email ||
            session.metadata?.donorEmail;

          const donorName =
            session.customer_details?.name ||
            session.metadata?.donorName ||
            'Anonymous';

          const amountPaid = session.amount_total ? session.amount_total / 100 : undefined;

          // Find existing donation record or upsert if session was initiated outside standard flow
          const updatedDonation = await Donation.findOneAndUpdate(
            { stripeSessionId: session.id },
            {
              $set: {
                status: 'completed',
                paymentStatus: session.payment_status,
                stripePaymentIntentId: session.payment_intent,
                donorEmail: donorEmail,
                donorName: donorName,
                paidAt: new Date(),
                ...(amountPaid && { amount: amountPaid, amountInCents: session.amount_total }),
                ...(session.metadata?.category && { category: session.metadata.category }),
                ...(session.metadata?.message && { message: session.metadata.message }),
              },
            },
            {
              new: true,
              upsert: true,
              setDefaultsOnInsert: true,
            }
          );

          console.log(
            `[Webhook] Verified donation recorded: $${updatedDonation.amount} USD from ${updatedDonation.donorName} (${updatedDonation.stripeSessionId})`
          );
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        await Donation.findOneAndUpdate(
          { stripePaymentIntentId: paymentIntent.id },
          {
            $set: {
              status: 'failed',
              paymentStatus: 'failed',
            },
          }
        );
        console.warn(`[Webhook] PaymentIntent failed: ${paymentIntent.id}`);
        break;
      }

      default:
        // Other events can be safely acknowledged
        break;
    }

    // Record the event as successfully processed for idempotency protection
    await ProcessedEvent.create({
      eventId: event.id,
      eventType: event.type,
    });

    return res.status(200).json({ received: true });
  } catch (processingErr) {
    console.error(`[Webhook Processing Error] Event ${event.id}:`, processingErr);
    return res.status(500).json({ error: 'Failed to process webhook event' });
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhook,
};
