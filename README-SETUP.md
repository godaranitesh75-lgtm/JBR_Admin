# JBR Electrical Admin - Setup Guide

## Overview

This is an **admin-only product management system** for JBR Electrical. There is no customer storefront - this application is solely for managing products, inventory, and generating reports.

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

### 2. Backend environment variables

Your `.env` is already configured:

```env
DATABASE_URL=postgresql://neondb_owner:...@ep-green-term-awhyorsd.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require
ADMIN_EMAIL=godaranitesh75@gmail.com
ADMIN_PASSWORD=Nitesh@1845#
JWT_SECRET=jbr_electrical_secret_key_2024_secure_production_key
PORT=3000
```

**Important:** The backend **auto-syncs credentials** on startup. Even if another project wrote to `admin_credentials`, your env vars will overwrite them on each restart. This solves the shared-database conflict.

### 3. Frontend environment variables

`.env.production.local` is already configured:

```env
VITE_PUBLIC_API_URL=https://jbrelec.onrender.com
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

- **Admin only**: Email + password from `.env` file
  - On first login, credentials are seeded into the database
  - On subsequent logins, database credentials are checked
  - If env vars change, database is updated on next backend restart
  - 15-minute session tokens

### Routes

| Path | Purpose | Auth |
|------|---------|------|
| `/` | Admin panel | Required |
| `/admin` | Admin panel (alias) | Required |
| `/api/products` | Public product list | None |
| `/api/admin/*` | Admin APIs | JWT |
| `/api/auth/login` | Admin login | None |

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

Visit http://localhost:5173 to access the admin panel.

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

The backend serves:
- Static files (admin panel) from `dist/`
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

✅ **Product Management**
- Create, read, update, delete products
- Image upload (base64, stored in database)
- Bulk operations (delete, activate/deactivate)

✅ **Inventory**
- Stock management with inline editing
- Low stock warnings
- Stock value calculations

✅ **Organization**
- Category management and filtering
- Product search
- Sort by various fields

✅ **Reports**
- Dashboard with statistics
- CSV export for products
- Stock reports

✅ **Security**
- Admin authentication with email/password
- JWT tokens (15-minute expiry)
- Session persistence
- Auto-sync credentials from environment variables

---

## Notes

- **Admin-only application** — no customer storefront
- **No Cloudinary needed** — images stored as base64 in database
- **Shared database safe** — credentials auto-sync from env vars on startup
- **Single deployment** — one backend serves the admin panel

---

## Troubleshooting

### Can't login

1. Check backend is running and `DATABASE_URL` is correct
2. Run the migration: `ALTER TABLE products RENAME COLUMN image_url TO image_data;`
3. Restart backend to sync credentials: `npm run dev:api`
4. Try login with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`
5. Check browser console for errors
6. Check backend logs for authentication errors

### Images not showing

- Images must be base64 `data:image/*` URLs
- Max ~3-4MB per image
- Use the "Choose image" button in admin panel (auto-converts to base64)

### Products list is empty

- Check `/api/products` returns data: `curl https://jbrelec.onrender.com/api/products`
- Add products through the admin panel
- Check database connection is working

### Page is blank after login

- Check browser console for JavaScript errors
- Verify the build completed successfully
- Clear browser cache and reload
- Check `dist/` folder exists with built files

---

## Admin Credentials

Login with:
- **Email:** godaranitesh75@gmail.com
- **Password:** Nitesh@1845#

These are stored in `.env` and auto-synced to the database on backend startup.
