# JBR Electrical admin deployment

The admin frontend must call the same JBR store API and PostgreSQL database as the customer storefront.

## Admin frontend

Set these Vercel **build** environment values, then redeploy:

```text
VITE_PUBLIC_API_URL=https://jbrelec.onrender.com
VITE_LOCAL_DEMO_MODE=false
VITE_PUBLIC_CATALOG_WRITES=false
```

Set the API's CORS allowlist (`CORS_ORIGIN` or `ALLOWED_ORIGINS`) to include the admin site's exact HTTPS origin. Do not configure database credentials or administrator passwords in the frontend.

## Store API database

Back up the production database. In the JBR storefront repository, confirm the `DATABASE_URL` targets the live store database and inspect whether catalog data already exists. If its Prisma schema is missing, run `npm run prisma:generate` and `npm run prisma:push` from that repository's `backend` directory. Do not run its seed script in production; it deletes records. If an older catalog exists in a different schema, migrate it deliberately to avoid a second empty catalog.

## Verify

1. Open the API `/api/health` endpoint.
2. In admin Settings, save the Vercel proxy URL. The panel checks the product endpoint as well as health.
3. Sign in with an existing user assigned the `ADMIN` role.
4. Create a test product and verify it appears on the customer storefront.

For detailed setup and troubleshooting, see [README-SETUP.md](./README-SETUP.md) and [README.md](./README.md).

The `render.yaml` service deploys a static demo website only; it does not deploy the store API or sync demo catalog changes to production.
