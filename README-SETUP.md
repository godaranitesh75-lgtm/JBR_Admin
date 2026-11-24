# JBR Electrical admin setup

The admin website must use the existing JBR storefront API and its PostgreSQL database. The admin frontend does not connect directly to PostgreSQL, and its optional Express backend uses a different schema and must not be used as the production store API.

The optional Express API in this repository uses the existing `public.products`, `public.admin_credentials`, and `public.admin_sessions` tables. It validates their required columns at startup and does not create or migrate tables. Product categories are stored in `products.category`; this is not the storefront Prisma `Product`/`Brand`/`Category`/`Inventory` schema. Use this API for the customer website only if that website reads from the same `public.products` table.

## Configure the admin frontend

In the admin frontend's Vercel **build** environment, set:

- `VITE_PUBLIC_API_URL`: the HTTPS base URL of the JBR store API.
- `VITE_LOCAL_DEMO_MODE=false`.
- `VITE_PUBLIC_CATALOG_WRITES=false`.
- Optionally, `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`.

Redeploy the frontend after changing these values. The `vercel.json` API rewrite is an optional proxy and targets the same store API; the recommended configuration calls the API URL directly.

On the store API host, set `CORS_ORIGIN` (or `ALLOWED_ORIGINS`) to include the admin frontend's exact HTTPS origin. Also allow the local development origin when testing directly from localhost.

## Database readiness

The store API health route only proves the server is responding; the product table can still be missing. The admin connection check also requests the product catalog, so it reports a missing database schema instead of showing a false connected state.

Back up the production database first. In the JBR storefront repository, inspect the existing catalog tables and then, if its Prisma schema has not been applied, run from that repository's `backend` directory:

```powershell
npm run prisma:generate
npm run prisma:push
```

Do not run the storefront seed script in production: it deletes existing records. If products already exist in a different table/schema, migrate them to the Prisma `Product`, `Brand`, `Category`, and `Inventory` tables deliberately before switching the admin panel; blindly creating new tables could leave two catalogs.

## Sign in and edit products

Sign in using an existing store account with the `ADMIN` role. The panel calls the store API's `/api/auth/login`, `/api/auth/me`, `/api/auth/password`, `/api/auth/logout`, and protected `/api/admin/products` endpoints. The API handles product/category/brand/inventory relations and returns the product image as `image_url`; the admin UI maps it to its internal image field.

Product changes require an authenticated admin session. The admin panel does not register store administrators; `/api/auth/register` is for customer registration. Ask the store owner to provision or activate an administrator account.

## Local development and troubleshooting

```powershell
npm ci
npm run dev
```

The default is local demo mode; its product edits are stored in the browser only. To test the live API locally, set `VITE_PUBLIC_API_URL` in `.env.local` and allow the local frontend origin in the store API's CORS settings. Do not put database credentials, admin passwords, or JWT secrets in frontend variables.

- If `/api/health` succeeds but the connection check fails on products, confirm the Prisma schema is applied to the same database used by the storefront.
- A `401` on `/api/admin/products` means sign-in is required or the session expired.
- A `403` means the signed-in user does not have the `ADMIN` role.
- If an edit succeeds but the storefront does not update, verify that both websites use the same API and database, and that the product is active.

If a version of this repository containing the previous setup notes was pushed or shared, rotate the database password, administrator password, and JWT secret. Rotate any credentials that have ever been checked into a repository.
