# Deployment Checklist - Customer Authentication

## Pre-Deployment

- [x] Backend TypeScript compiles without errors
- [x] Frontend TypeScript compiles without errors  
- [x] Frontend build succeeds (`npm run build`)
- [x] Schema updated with customer tables
- [x] README updated with auth documentation

## Backend Deployment (Render.com)

### Step 1: Push to Git
```bash
git add .
git commit -m "Add customer authentication to storefront"
git push origin main
```

### Step 2: Deploy on Render
- Render will auto-detect the git push
- Backend will restart automatically
- On startup, it will:
  - Create `customer_credentials` table
  - Create `customer_sessions` table
  - Sync admin credentials from env vars

### Step 3: Verify Backend
```bash
# Check health endpoint
curl https://jbrelec.onrender.com/api/health

# Test customer registration (replace with test email)
curl -X POST https://jbrelec.onrender.com/api/auth/customer-register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","name":"Test User"}'
```

## Frontend Deployment

The frontend is already built in `dist/` folder and will be served by the backend.

### Verify Frontend
1. Visit: https://jbrelec.onrender.com/
2. Should see customer login/register form
3. Try registering a new account
4. Should auto-login and show products

## Post-Deployment Testing

### Customer Flow
- [ ] Visit storefront at `/`
- [ ] See login form
- [ ] Click "Create one" to register
- [ ] Fill in email and password (min 8 chars)
- [ ] Submit → should auto-login
- [ ] See products list
- [ ] Click logout (X icon in header)
- [ ] Should return to login form
- [ ] Login again with same credentials
- [ ] Should work

### Admin Flow
- [ ] Visit admin panel at `/admin`
- [ ] Login with `godaranitesh75@gmail.com` / `Nitesh@1845#`
- [ ] Should see admin dashboard
- [ ] Try adding/editing products
- [ ] Should work normally

### Edge Cases
- [ ] Try registering with duplicate email → should show error
- [ ] Try login with wrong password → should show error
- [ ] Refresh page while logged in → should stay logged in
- [ ] Clear localStorage → should return to login
- [ ] Test on mobile browser → should be responsive

## Database Verification

Connect to Neon database and verify:

```sql
-- Check customer credentials table exists
SELECT * FROM customer_credentials LIMIT 1;

-- Check customer sessions table exists
SELECT * FROM customer_sessions LIMIT 1;

-- Verify admin credentials (should have id=1)
SELECT id, username, updated_at FROM admin_credentials WHERE id = 1;
```

## Rollback Plan (if needed)

If customer authentication causes issues:

1. Revert to previous git commit:
```bash
git revert HEAD
git push origin main
```

2. Or make customers bypass auth temporarily:
   - Remove authentication check in `Storefront.tsx`
   - Remove JWT validation from `/api/products` route

## Support Contacts

- Backend URL: https://jbrelec.onrender.com
- Database: Neon PostgreSQL (ep-green-term-awhyorsd)
- Admin Email: godaranitesh75@gmail.com

## Notes

- Customer sessions last 24 hours (JWT expiry)
- Admin sessions last 15 minutes (more secure)
- Rate limits: 5 registrations, 10 logins per 15 minutes per IP
- Passwords are hashed with scrypt (secure, not reversible)
- No email verification (users can register and use immediately)
