const ContactMessage = require('../models/ContactMessage');
const { sendContactEmail, getDestinationEmail } = require('../utils/emailService');

// In-memory rate limiting map: ip -> Array of timestamps
const ipRequestHistory = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 5;

// Periodic cleanup of rate limit history every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of ipRequestHistory.entries()) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
    if (valid.length === 0) {
      ipRequestHistory.delete(ip);
    } else {
      ipRequestHistory.set(ip, valid);
    }
  }
}, 10 * 60 * 1000).unref();

/**
 * Check if IP has exceeded submission limits
 */
const checkRateLimit = (ip) => {
  if (!ip) return false;
  const now = Date.now();
  const history = ipRequestHistory.get(ip) || [];
  const recent = history.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    return true; // Exceeded limit
  }

  recent.push(now);
  ipRequestHistory.set(ip, recent);
  return false;
};

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @desc    Submit public contact message & deliver email
 * @route   POST /api/contact
 * @access  Public
 */
const submitContactMessage = async (req, res, next) => {
  try {
    const { name, email, subject, message, _gotcha, honeypot, website } = req.body || {};

    // 1. Anti-Spam Honeypot Check:
    // If hidden fields intended for bots are filled, return 200 without sending email
    if (_gotcha || honeypot || website) {
      console.log('[Contact Form] Spam honeypot triggered; silently dropping submission.');
      return res.status(200).json({
        success: true,
        message: 'Thank you! Your message has been received.',
      });
    }

    // 2. Client IP extraction and rate-limiting
    const clientIp =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    if (process.env.NODE_ENV !== 'test' && checkRateLimit(clientIp)) {
      return res.status(429).json({
        success: false,
        message: 'Too many contact requests from this IP. Please wait a few minutes before trying again.',
      });
    }

    // 3. Input Validation
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const trimmedSubject = typeof subject === 'string' ? subject.trim() : '';
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    if (!trimmedName || trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name is required (at least 2 characters).',
      });
    }

    if (trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Name cannot exceed 100 characters.',
      });
    }

    if (!trimmedEmail || !EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'A valid email address is required.',
      });
    }

    if (trimmedEmail.length > 150) {
      return res.status(400).json({
        success: false,
        message: 'Email address cannot exceed 150 characters.',
      });
    }

    if (!trimmedSubject || trimmedSubject.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Subject is required (at least 2 characters).',
      });
    }

    if (trimmedSubject.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'Subject cannot exceed 200 characters.',
      });
    }

    if (!trimmedMessage || trimmedMessage.length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Message is required (at least 5 characters).',
      });
    }

    if (trimmedMessage.length > 5000) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot exceed 5000 characters.',
      });
    }

    // 4. Record contact message in MongoDB for persistence and auditability
    const contactRecord = new ContactMessage({
      name: trimmedName,
      email: trimmedEmail,
      subject: trimmedSubject,
      message: trimmedMessage,
      ipAddress: clientIp !== 'unknown' ? clientIp : undefined,
      isDelivered: false,
    });

    await contactRecord.save();

    // 5. Attempt Email Delivery
    try {
      const emailResult = await sendContactEmail({
        name: trimmedName,
        email: trimmedEmail,
        subject: trimmedSubject,
        message: trimmedMessage,
        timestamp: contactRecord.createdAt,
      });

      // Update record as successfully delivered
      contactRecord.isDelivered = true;
      contactRecord.deliveredAt = new Date();
      await contactRecord.save();

      return res.status(200).json({
        success: true,
        message: 'Thank you! Your message has been sent successfully to Al Hidayah Islamic Center.',
        data: {
          id: contactRecord._id,
          delivered: true,
          recipient: getDestinationEmail(),
        },
      });
    } catch (deliveryError) {
      contactRecord.isDelivered = false;
      contactRecord.deliveryError = deliveryError.message;
      await contactRecord.save().catch(() => {});

      if (deliveryError.code === 'SMTP_NOT_CONFIGURED') {
        return res.status(503).json({
          success: false,
          message:
            'Email delivery service is currently being configured on the server. Your message was saved. You may also contact us directly at alhidayahislamiccenter26@gmail.com.',
        });
      }

      return res.status(500).json({
        success: false,
        message:
          'Unable to deliver email message at this time. Please try again later or email alhidayahislamiccenter26@gmail.com directly.',
      });
    }
  } catch (error) {
    console.error('[SubmitContactMessage Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get all submitted contact messages (Admin Audit)
 * @route   GET /api/contact/messages or GET /api/admin/contact-messages
 * @access  Private (Admin only)
 */
const getContactMessages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.delivered !== undefined) {
      filter.isDelivered = req.query.delivered === 'true';
    }
    if (req.query.search) {
      const term = String(req.query.search).trim();
      filter.$or = [
        { name: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { subject: { $regex: term, $options: 'i' } },
      ];
    }

    const [messages, totalCount] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      ContactMessage.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: messages.length,
      pagination: {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
      messages,
      data: messages,
    });
  } catch (error) {
    console.error('[GetContactMessages Error]:', error);
    next(error);
  }
};

/**
 * @desc    Get single contact message by ID
 * @route   GET /api/contact/messages/:id or GET /api/admin/contact-messages/:id
 * @access  Private (Admin only)
 */
const getContactMessageById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const message = await ContactMessage.findById(id).lean();

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Contact message not found.',
      });
    }

    return res.status(200).json({
      success: true,
      message,
      data: message,
    });
  } catch (error) {
    console.error('[GetContactMessageById Error]:', error);
    next(error);
  }
};

module.exports = {
  submitContactMessage,
  getContactMessages,
  getContactMessageById,
};
