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

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Payments**: Stripe Node SDK
- **Security**: JWT (`jsonwebtoken`), `bcryptjs`, `cors`, `cookie-parser`
- **Deployment**: Vercel Serverless Functions

## License

ISC License.
