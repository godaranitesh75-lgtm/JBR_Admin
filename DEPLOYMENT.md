# Deployment Guide - JBR Electrical Admin Panel

## What This Is

An **admin-only product management system** for JBR Electrical. No customer storefront, no customer authentication.

---

## Quick Deploy Steps

### 1. Push to Git

```bash
git add .
git commit -m "Admin-only product management system with base64 images"
git push origin main
```

### 2. Render.com Will Auto-Deploy

Your backend is at: `https://jbrelec.onrender.com`

Environment variables already set:
- `DATABASE_URL` - Neon PostgreSQL connection
- `ADMIN_EMAIL` - godaranitesh75@gmail.com
- `ADMIN_PASSWORD` - Nitesh@1845#
- `JWT_SECRET` - your secret key
- `NODE_ENV` - production
- `PORT` - 3000

### 3. Database Migration

If you haven't already, run this once in Neon SQL Editor:

```sql
ALTER TABLE products RENAME COLUMN image_url TO image_data;
```

Or via command line:
```bash
psql "postgresql://neondb_owner:npg_TnUizRlZ6D7W@ep-green-term-awhyorsd.c-12.us-east-1.aws.neon.tech/neondb?sslmode=require" -f migrate-to-image-data.sql
```

---

## What Changed

### ✅ Removed
- Customer storefront (`Storefront.tsx` deleted)
- Customer authentication endpoints
- Customer database tables
- Path-based routing (no `/` vs `/admin` split)

### ✅ Kept
- Admin panel with full product management
- Admin authentication (email/password from env vars)
- Base64 image storage in database
- Auto-sync of admin credentials on startup

---

## Access the Admin Panel

After deployment:

1. Visit: https://jbrelec.onrender.com
2. Login with:
   - Email: `godaranitesh75@gmail.com`
   - Password: `Nitesh@1845#`
3. Manage products, upload images, export reports

---

## Testing Checklist

- [ ] Visit https://jbrelec.onrender.com
- [ ] Login page shows (not blank page)
- [ ] Login with admin credentials works
- [ ] Dashboard shows product stats
- [ ] Can add new product with image
- [ ] Can edit existing products
- [ ] Can delete products
- [ ] Can export CSV
- [ ] Images display correctly
- [ ] Session persists on page refresh

---

## If Something Goes Wrong

### Can't login
1. Check backend logs on Render.com
2. Verify `ADMIN_EMAIL` and `ADMIN_PASSWORD` env vars
3. Restart the backend service (will re-sync credentials)

### Images not showing
- Check they're base64 data URLs (start with `data:image/`)
- Check database `image_data` column has data
- Check browser console for errors

### Blank page
- Check browser console for JavaScript errors
- Verify build completed on Render
- Check `dist/` folder was deployed

---

## Admin Credentials

**Email:** godaranitesh75@gmail.com  
**Password:** Nitesh@1845#

These are in `.env` and auto-sync to database on backend startup.

---

## API Endpoints

| Endpoint | Purpose | Auth |
|----------|---------|------|
| `GET /api/health` | Health check | None |
| `GET /api/products` | List all products | None |
| `POST /api/auth/login` | Admin login | None |
| `GET /api/admin/products` | Admin product list | JWT |
| `POST /api/admin/products` | Create product | JWT |
| `PATCH /api/admin/products/:id` | Update product | JWT |
| `DELETE /api/admin/products/:id` | Delete product | JWT |

---

## Support

- Backend: https://jbrelec.onrender.com
- Database: Neon PostgreSQL (ep-green-term-awhyorsd)
- Documentation: See README-SETUP.md
