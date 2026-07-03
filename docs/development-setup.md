# Development Setup

> Local setup instructions for WBOS development.

---

# Prerequisites

* Node.js 24+
* npm
* PostgreSQL 17
* A configured `.env` file

WBOS currently uses a PostgreSQL 17 database running on the development homelab server.

---

# Environment

Create `.env` from `.env.example` and configure:

```env
DATABASE_URL="postgresql://wbos:<password>@192.168.100.36:5432/wbos?schema=public"
BETTER_AUTH_SECRET="<generated-secret>"
BETTER_AUTH_URL="http://localhost:3000"
NEXT_PUBLIC_BETTER_AUTH_URL="http://localhost:3000"
WBOS_STORAGE_ROOT="./storage"
```

Do not commit real secrets.

---

# First Run

Install dependencies:

```bash
npm install
```

Generate Prisma Client:

```bash
npm run db:generate
```

Apply migrations:

```bash
npm run db:migrate
```

Start the application:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Authentication And Onboarding

Create users through the WBOS sign-up screen.

After sign-up, WBOS automatically creates:

* Organization
* Owner OrganizationMembership
* BusinessSettings
* Default DocumentSequence records
* ActivityLog entry

Better Auth owns user creation, password hashing, sessions, and sign-out.

WBOS owns organization onboarding, tenant resolution, authorization, and business services.

---

# Development Seed

The seed does not create Better Auth password records.

Create a user through the sign-up screen first, then run:

```bash
npm run db:seed
```

Optional:

```bash
WBOS_SEED_USER_EMAIL="owner@example.com" npm run db:seed
WBOS_SEED_ORGANIZATION_NAME="Demo Wholesale" npm run db:seed
```

If the user already belongs to an organization, the seed skips safely.

---

# Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm run db:generate
npm run db:migrate
npm run db:studio
npm run db:seed
```

---

# Architecture Boundaries

Authentication:

* Better Auth
* `src/infrastructure/auth`

Tenant resolution:

* `src/infrastructure/tenancy`
* `src/infrastructure/request`

Authorization:

* `src/infrastructure/authorization`

Business services:

* `src/domains/*/services`

Pages and server actions should consume these services rather than duplicating session, tenant, or permission logic.
