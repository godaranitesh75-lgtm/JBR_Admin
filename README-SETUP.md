# JBR Electrical - Setup Guide

## Quick Start

This project has **two separate applications**:

1. **Customer Storefront** (`/`) - Shopping page with customer authentication
2. **Admin Panel** (`/admin`) - Product management with admin authentication

**IMPORTANT:** All users (customers and admins) must login with email/password to access the site.

---

## Database Setup (Neon PostgreSQL)

### 1. Run the migration

Your Neon database already has the old `image_url` column. Run this migration to rename it:

```bash
# Connect to your Neon database and run:
psql "postgresql://neondb_owner:npg_TnUizRlZ6D7W@ep-green-term-awhyorsd.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require" -f migrate-to-image-data.sql
```

Or run it manually in the Neon SQL Editor:

```sql
ALTER TABLE products RENAME COLUMN image_url TO image_data;
```

**Note:** The backend will automatically create the new `customer_credentials` and `customer_sessions` tables on startup.

### 2. Backend environment variables

Your `.env` is already configured:

```env
DATABASE_URL=postgresql://neondb_owner:...@ep-green-term-awhyorsd.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require
ADMIN_EMAIL=godaranitesh75@gmail.com
ADMIN_PASSWORD=Nitesh@1845#
JWT_SECRET=jbr_electrical_secret_key_2024_secure_production_key
PORT=3000
```

**Important:** The backend now **auto-syncs admin credentials** on startup. Even if another project wrote to `admin_credentials`, your env vars will overwrite them on each restart. This solves the shared-database conflict.

### 3. Frontend environment variables

`.env.production.local` is already configured:

```env
VITE_PUBLIC_API_URL=https://jbrelec.onrender.com
VITE_LOCAL_DEMO_MODE=false
VITE_PUBLIC_CATALOG_WRITES=false
```

---

## How It Works

### Image Storage

Images are stored as **base64 data URLs** directly in the database:

```
data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...
```

- Max size: ~3-4MB per image (5MB base64 limit in validation)
- Formats: JPEG, PNG, WebP, AVIF
- No external services needed (no Cloudinary)

### Authentication

- **Customer Storefront**:
  - Customers must login or register to browse products
  - Email + password authentication
  - Self-service registration (no approval required)
  - 24-hour session tokens
  
- **Admin Panel**:
  - Email + password from `.env`
  - On first login, credentials are seeded into the database
  - On subsequent logins, database credentials are checked
  - If env vars change, database is updated on next backend restart
  - 15-minute session tokens (more secure)

### Routes

| Path | App | Auth |
|------|-----|------|
| `/` | Customer storefront | Required (customer) |
| `/admin` | Admin panel | Required (admin) |
| `/api/products` | Product list | None (public endpoint) |
| `/api/auth/customer-login` | Customer login | None |
| `/api/auth/customer-register` | Customer register | None |
| `/api/auth/login` | Admin login | None |
| `/api/admin/*` | Admin APIs | JWT (admin) |

---

## Development

```bash
# Install dependencies
npm install

# Start backend (port 3000)
npm run dev:api

# Start frontend dev server (port 5173)
npm run dev
```

Visit:
- Customer storefront: http://localhost:5173
- Admin panel: http://localhost:5173/admin

---

## Production Build

```bash
# Build frontend
npm run build:web

# Build backend
npm run build:server

# Start production server
npm start
```

The backend serves both:
- Static files (storefront + admin) from `dist/`
- API routes at `/api/*`

---

## Deployment

### Backend (Render.com)

Already deployed at `https://jbrelec.onrender.com`

Environment variables:
```
DATABASE_URL=<your-neon-url>
ADMIN_EMAIL=godaranitesh75@gmail.com
ADMIN_PASSWORD=Nitesh@1845#
JWT_SECRET=jbr_electrical_secret_key_2024_secure_production_key
NODE_ENV=production
PORT=3000
```

### Frontend Build

Already configured in `.env.production.local`:
```
VITE_PUBLIC_API_URL=https://jbrelec.onrender.com
```

---

## Admin Panel Features

- ✅ Product CRUD (create, read, update, delete)
- ✅ Image upload (base64, stored in database)
- ✅ Stock management with inline editing
- ✅ Category & status filters
- ✅ Search products
- ✅ CSV export
- ✅ Publish/unpublish products
- ✅ Dashboard with stats
- ✅ Admin authentication with email/password

## Customer Storefront Features

- ✅ Customer registration (self-service)
- ✅ Customer login/logout
- ✅ Browse all active products (after login)
- ✅ Category filtering
- ✅ Search products
- ✅ Product details modal
- ✅ Add to cart (local state)
- ✅ Order via WhatsApp (cart → message)
- ✅ Responsive design
- ✅ Session persistence (localStorage)

---

## Notes

- **Customer authentication required** — customers must login/register to browse products
- **Admin authentication separate** — admins use different credentials and panel
- **No Cloudinary needed** — images are stored in the database as base64
- **Shared database safe** — admin credentials auto-sync from env vars on startup
- **Single deployment** — one backend serves both storefront and admin
- **Customer data stored in PostgreSQL** — `customer_credentials` table

---

## Troubleshooting

### Can't login to admin

1. Check backend is running and `DATABASE_URL` is correct
2. Run the migration: `ALTER TABLE products RENAME COLUMN image_url TO image_data;`
3. Restart backend to sync credentials: `npm run dev:api`
4. Try login with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`

### Can't login as customer

1. Click "Create one" on the login page to register
2. Use a valid email and password (min 8 characters)
3. Check backend logs for errors: `npm run dev:api`
4. Session is stored in localStorage — check browser console for errors

### Images not showing

- Images must be base64 `data:image/*` URLs
- Max ~3-4MB per image
- Use the "Choose image" button in admin panel (auto-converts to base64)

### Storefront shows login but I want public access

- The current design requires customer authentication
- To make it public, remove the authentication check in `Storefront.tsx`
- Update backend to remove JWT validation from `/api/products` route
