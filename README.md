# JBR Electrical catalog manager

This React + TypeScript admin site edits products through the same authenticated API used by the JBR customer storefront. It does not connect directly to PostgreSQL or create a separate production catalog.

## Production setup

Configure these values in the admin frontend's Vercel **build** environment:

- `VITE_PUBLIC_API_URL=https://jbrelec.onrender.com`
- `VITE_LOCAL_DEMO_MODE=false`
- `VITE_PUBLIC_CATALOG_WRITES=false`
- Optional image uploads: `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`

Redeploy after changing build variables. On the store API host, set `CORS_ORIGIN` (or `ALLOWED_ORIGINS`) to include the admin frontend's exact HTTPS origin, then redeploy the API. Sign in with an existing JBR user account whose role is `ADMIN`; the admin panel does not create administrator accounts. Never put database credentials, admin passwords, or JWT secrets in frontend build variables or the APK.

The store API must use the same production database as the customer website. Before applying its Prisma schema to a live database, back up the database and verify whether catalog data already exists in another table. If the schema has not been applied, run `npm run prisma:generate` and `npm run prisma:push` from the store repository's `backend` directory. Do not run its seed script on production; it deletes existing records. If an older catalog exists in a different schema, migrate it deliberately rather than creating a second empty catalog.

The admin Settings connection check tests both the API health endpoint and the actual product listing. A successful health response alone does not prove that the product tables are ready.

## Local development

Requirements: Node.js 20 or newer and npm.

```powershell
npm ci
npm run dev
```

By default the admin site uses a local demo catalog, which never syncs to the live store. To test against the live API, set `VITE_PUBLIC_API_URL` in a local `.env.local` file and use an API URL that permits the local origin in CORS. Never put database or authentication secrets in frontend environment variables.

Build and validate the frontend:

```powershell
npm run build:web
npm run test:api
```

This repository contains an optional standalone Express API for legacy/development use. Its `public.products` schema and authentication tables are not the JBR storefront's Prisma schema; do not deploy it as a replacement for the store API or point it at the production database.

## Optional Android app

Build with Android Studio, Android SDK Platform 35 / Build-Tools 35, and JDK 21:

```powershell
npm run android:apk
```

The APK uses the same API URL and admin sign-in as the web build. For a live build, configure the Vercel proxy URL above before building. Keep the database connection string and signing secrets on the server.

## Features

- Create, edit, search, filter, publish/draft, archive, and delete products.
- Adjust stock using one-touch controls or direct quantity entry.
- Upload product photos to Cloudinary or use HTTPS image URLs.
- Preview the customer storefront layout.
- Export and restore local demo catalog backups.
