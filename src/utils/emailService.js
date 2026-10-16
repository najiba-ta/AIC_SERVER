const nodemailer = require('nodemailer');

const DEFAULT_DESTINATION_EMAIL = 'alhidayahislamiccenter26@gmail.com';

/**
 * Get active destination email for contact inquiries
 */
const getDestinationEmail = () => {
  return (process.env.CONTACT_DESTINATION_EMAIL || DEFAULT_DESTINATION_EMAIL).trim();
};

/**
 * Build nodemailer transport based on environment variables
 */
const createEmailTransporter = () => {
  const host = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const user = process.env.SMTP_USER || process.env.EMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || '587', 10);
  const secure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.EMAIL_SECURE === 'true' ||
    port === 465;

  // In test environment or test mock mode, allow test transport
  if (process.env.NODE_ENV === 'test' && !host && !user) {
    return {
      isMock: true,
      sendMail: async (mailOptions) => {
        return {
          messageId: `mock-msg-${Date.now()}@aic.local`,
          response: '250 Mock email accepted for delivery',
          envelope: {
            from: mailOptions.from,
            to: Array.isArray(mailOptions.to) ? mailOptions.to : [mailOptions.to],
          },
        };
      },
    };
  }

  // If specific SMTP credentials are provided
  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
  }

  // Default to standard Gmail service transport if only user and pass are provided
  if (user && pass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });
  }

  return null;
};

/**
 * Format HTML message for contact notifications
 */
const buildContactHtml = ({ name, email, subject, message, timestamp }) => {
  const formattedDate = new Date(timestamp || Date.now()).toUTCString();

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>New Contact Inquiry - Al Hidayah Islamic Center</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 24px; color: #1e293b; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0; }
    .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 28px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin-bottom: 24px; }
    .meta-row { display: flex; margin-bottom: 8px; font-size: 14px; }
    .meta-row:last-child { margin-bottom: 0; }
    .meta-label { font-weight: 600; width: 100px; color: #64748b; }
    .meta-value { color: #0f172a; flex: 1; word-break: break-word; }
    .message-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #0f172a; }
    .message-body { background: #ffffff; border: 1px solid #cbd5e1; border-left: 4px solid #0284c7; padding: 16px; border-radius: 4px; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap; word-break: break-word; }
    .footer { background: #f8fafc; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Al Hidayah Islamic Center</h1>
      <p>Official Website Contact Notification</p>
    </div>
    <div class="content">
      <div class="meta-box">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; font-weight: 600; color: #64748b; width: 110px;">From:</td>
            <td style="padding: 4px 0; color: #0f172a;">${escapeHtml(name)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Email:</td>
            <td style="padding: 4px 0; color: #0f172a;"><a href="mailto:${escapeHtml(email)}" style="color: #0284c7; text-decoration: none;">${escapeHtml(email)}</a></td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Subject:</td>
            <td style="padding: 4px 0; color: #0f172a; font-weight: 600;">${escapeHtml(subject)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: 600; color: #64748b;">Submitted:</td>
            <td style="padding: 4px 0; color: #64748b;">${formattedDate}</td>
          </tr>
        </table>
      </div>

      <div class="message-title">Inquiry Message:</div>
      <div class="message-body">${escapeHtml(message)}</div>
    </div>
    <div class="footer">
      <p style="margin: 0;">You can reply directly to this email to respond to <strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}).</p>
      <p style="margin: 4px 0 0 0;">Al Hidayah Islamic Center &bull; Automated Contact Dispatcher</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

/**
 * Format plain text fallback
 */
const buildContactText = ({ name, email, subject, message, timestamp }) => {
  const formattedDate = new Date(timestamp || Date.now()).toUTCString();

  return `
==================================================
AL HIDAYAH ISLAMIC CENTER - NEW CONTACT INQUIRY
==================================================

From:      ${name}
Email:     ${email}
Subject:   ${subject}
Submitted: ${formattedDate}

--------------------------------------------------
MESSAGE:
--------------------------------------------------
${message}

--------------------------------------------------
Note: Replying to this email will directly respond to ${email}.
`.trim();
};

/**
 * Helper to escape HTML special characters
 */
const escapeHtml = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Deliver contact form message to destination email
 *
 * @param {Object} options
 * @param {string} options.name
 * @param {string} options.email
 * @param {string} options.subject
 * @param {string} options.message
 * @param {Date|number} [options.timestamp]
 * @returns {Promise<{ success: boolean, messageId: string }>}
 */
const sendContactEmail = async ({ name, email, subject, message, timestamp = new Date() }) => {
  const destinationEmail = getDestinationEmail();
  const transporter = createEmailTransporter();

  if (!transporter) {
    const errorMsg =
      'Email delivery service is not configured. Please set SMTP_USER and SMTP_PASS in server environment variables.';
    console.error(`[Email Service Warning]: ${errorMsg}`);
    const err = new Error(errorMsg);
    err.code = 'SMTP_NOT_CONFIGURED';
    throw err;
  }

  // Trusted sender address
  const senderUser = process.env.SMTP_USER || process.env.EMAIL_USER || 'noreply@alhidayah.org';
  const senderAddress =
    process.env.SMTP_FROM ||
    process.env.EMAIL_FROM ||
    `"Al Hidayah Islamic Center" <${senderUser}>`;

  const mailOptions = {
    from: senderAddress,
    to: destinationEmail,
    replyTo: `"${name.replace(/"/g, '')}" <${email}>`,
    subject: `[AIC Contact] ${subject} - from ${name}`,
    text: buildContactText({ name, email, subject, message, timestamp }),
    html: buildContactHtml({ name, email, subject, message, timestamp }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(
      `[Contact Email Sent] Message dispatched to ${destinationEmail} (messageId: ${info.messageId})`
    );
    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (err) {
    // Sanitize error logging to ensure credentials are never leaked
    const safeErrorMessage = err.message || 'Unknown SMTP error';
    console.error(`[Contact Email Delivery Error]: ${safeErrorMessage}`);
    const deliveryError = new Error('Failed to deliver email message to destination inbox.');
    deliveryError.originalCode = err.code || 'SMTP_DELIVERY_FAILED';
    throw deliveryError;
  }
};

module.exports = {
  getDestinationEmail,
  sendContactEmail,
  createEmailTransporter,
};
