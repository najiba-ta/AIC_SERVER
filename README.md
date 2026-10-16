# Al Hidayah Islamic Center (AIC) - Backend API Server

Robust Express.js and MongoDB REST API backend supporting the Al Hidayah Islamic Center web platform, Student Admission portal, Teacher Employment Applications, Stripe donation processing, and secure Admin Portal.

## Key Features

- **Multi-Role Authentication & Security**:
  - JWT token-based authentication for students, teachers, and admins.
  - Hybrid admin middleware accepting either Bearer JWTs or configured `x-admin-key` headers.
  - Role-based route protection and ownership access control.
- **Student Admission Management**:
  - Full electronic student admission submission with guardian consent.
  - Sequential, unique ID generation (`AIC-STU-XXX`).
  - Administrative review workflow (Approve, Reject with reasons, and Office-Use assignments).
- **Leadership & Team Management**:
  - Full CRUD and publishing controls for AIC Leadership, Teachers, and Administration.
  - Public visibility controls, category filtering, search, and customized sequential display reordering.
- **Teacher Employment Applications**:
  - Complete multi-step teacher employment application with qualifications, experience, skills, and references.
  - Isolated sequential ID generation (`AIC-TEA-XXX`).
  - Automatic synchronization with User accounts upon approval/rejection.
- **Stripe Donations & Webhooks**:
  - Stripe Checkout session creation for general, zakat, and sadaqah funds.
  - Idempotent webhook processing to record completed donations and maintain aggregate statistics.
- **Admin Dashboard & Operations**:
  - Live analytics and aggregate donation statistics.
  - Centralized member directory and verification queue.

## API Endpoints Overview

| Module | Endpoints | Access |
|---|---|---|
| **Health** | `GET /api/health` | Public |
| **Auth** | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | Public / Protected |
| **Admin Auth** | `POST /api/admin/login`, `POST /api/admin/register` | Public / API Key |
| **Donations** | `POST /api/stripe/checkout`, `POST /api/stripe/webhook` | Public |
| **Admin Donations** | `GET /api/admin/donations`, `GET /api/admin/stats` | Admin |
| **Student Admissions** | `POST /api/admissions`, `GET /api/admissions/my-application`, `GET /api/admissions/:id` | Authenticated Student / Admin |
| **Admin Admissions** | `GET /api/admin/admissions`, `PATCH /api/admin/admissions/:id/approve`, `PATCH /api/admin/admissions/:id/reject` | Admin |
| **Teacher Applications**| `POST /api/teacher-applications`, `GET /api/teacher-applications/my-application` | Authenticated Teacher / Admin |
| **Admin Teachers** | `GET /api/admin/teacher-applications`, `PATCH /api/admin/teacher-applications/:id/approve`, `PATCH /api/admin/teacher-applications/:id/reject` | Admin |
| **Team Members** | `GET /api/team-members`, `GET /api/team-members/:id` | Public (Published only) |
| **Admin Team Members** | `POST /api/team-members`, `PATCH /api/team-members/:id`, `DELETE /api/team-members/:id`, `PATCH /api/team-members/:id/publish`, `PATCH /api/team-members/reorder` | Admin |
| **Contact Form** | `POST /api/contact` | Public |
| **Admin Contact Logs** | `GET /api/admin/contact-messages`, `GET /api/contact/messages` | Admin |

## Contact Form & Email Delivery Setup

The server delivers contact form messages to the official AIC inbox:
* **Destination Email**: `alhidayahislamiccenter26@gmail.com`
* **Public Endpoint**: `POST /api/contact`
* **Payload**:
  ```json
  {
    "name": "Visitor Name",
    "email": "visitor@example.com",
    "subject": "Inquiry Subject",
    "message": "Inquiry message content..."
  }
  ```
* **Security & Features**:
  - `replyTo` is automatically set to the visitor's email address so AIC staff can reply directly.
  - Trusted sender address is used for the `from` header.
  - Submissions are logged in MongoDB (`ContactMessage`) for audit and delivery tracking.
  - Built-in honeypot spam protection (`_gotcha`, `honeypot`, `website`).
  - IP-based rate limiting (max 5 submissions per 15-minute window per IP).

### Required Environment Variables

Configure the following variables in `.env` (local) or Vercel Environment Variables (production):

```ini
CONTACT_DESTINATION_EMAIL=alhidayahislamiccenter26@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_sender_account@gmail.com
SMTP_PASS=your_16_digit_gmail_app_password
SMTP_FROM="Al Hidayah Islamic Center" <noreply@alhidayah.org>
```

#### How to configure Gmail SMTP (App Password)
1. Go to your Google Account at [myaccount.google.com](https://myaccount.google.com/).
2. Navigate to **Security** and ensure **2-Step Verification** is turned ON.
3. Under 2-Step Verification, select **App passwords**.
4. Create a new app password (e.g. named `AIC Server Mailer`).
5. Copy the 16-character generated password and set it as `SMTP_PASS`.
6. Set `SMTP_USER` to your Gmail address.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Payments**: Stripe Node SDK
- **Email Delivery**: Nodemailer (SMTP)
- **Security**: JWT (`jsonwebtoken`), `bcryptjs`, `cors`, `cookie-parser`
- **Deployment**: Vercel Serverless Functions

## License

ISC License.
