const dotenv = require('dotenv');
dotenv.config();

const { sendContactEmail, getDestinationEmail } = require('../src/utils/emailService');

async function verifyEmail() {
  console.log('====================================================');
  console.log('AIC SERVER REAL EMAIL DELIVERY VERIFICATION');
  console.log('====================================================\n');

  const destination = getDestinationEmail();
  console.log(`Target Inbox: ${destination}`);
  console.log(`SMTP User:    ${process.env.SMTP_USER || process.env.EMAIL_USER || '(Not configured)'}`);
  console.log(`SMTP Pass:    ${process.env.SMTP_PASS ? '******** (Configured)' : '(Not configured)'}`);
  console.log(`SMTP Host:    ${process.env.SMTP_HOST || 'smtp.gmail.com (default)'}\n`);

  if (!process.env.SMTP_USER && !process.env.EMAIL_USER) {
    console.error('❌ Cannot verify real delivery: SMTP_USER is missing.');
    console.log('\nTo fix: set SMTP_USER and SMTP_PASS in your .env file or Vercel environment.');
    process.exit(1);
  }

  if (!process.env.SMTP_PASS && !process.env.EMAIL_PASS) {
    console.error('❌ Cannot verify real delivery: SMTP_PASS is missing.');
    console.log('\nTo fix: generate a 16-character App Password from Google and set SMTP_PASS.');
    process.exit(1);
  }

  try {
    console.log(`Attempting to send real verification email to ${destination}...`);
    const result = await sendContactEmail({
      name: 'AIC Verification Bot',
      message: 'Assalamu Alaikum. This is an automated real-email delivery verification message for Al Hidayah Islamic Center. If you are reading this email, the production contact form email pipeline is working 100% successfully!',
      subject: 'Real Email Delivery Verification Test',
      timestamp: new Date(),
    });

    console.log('\n✅ SUCCESS! Real email was dispatched successfully.');
    console.log(`Message ID: ${result.messageId}`);
    console.log(`Delivered To: ${destination}`);
    console.log('\nPlease check your Gmail inbox (and Spam/Junk folder just in case) to confirm receipt.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ EMAIL DISPATCH FAILED:');
    console.error(error.message);
    process.exit(1);
  }
}

verifyEmail();
