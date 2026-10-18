# JBR Electrical mobile catalog manager

This React + TypeScript Capacitor app manages products through the same API/database used by `https://jbr-electrical.vercel.app`; it does not create a second catalog. The API URL is preconfigured in the ignored `.env.production.local` file and is embedded in APK builds. Database credentials and SMS provider credentials belong only in the private API environment.

## Production API and OTP setup

The API source in `server/index.ts` implements the production OTP endpoints. The live API must be updated with this server code before an APK using OTP sign-in can authenticate. Deploy it to the **same API/database used by the website** so app edits appear on the main website.

Configure these private server environment variables:

- `DATABASE_URL`: the existing shared PostgreSQL connection string.
- `JWT_SECRET`: a randomly generated secret of at least 32 characters.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID`: Twilio Verify credentials.

Apply the `admin_sessions` table from `schema.sql` to the shared database before deploying. Only +91 8209305040 can request and verify OTPs; this allowlist is enforced by the API in `server/index.ts`. Keep OTP sending behind this API; never put Twilio credentials in the APK. OTP requests are rate-limited.

The app stores its refresh session on the device so sign-in survives app restarts. Short-lived API tokens renew automatically; signing out revokes the server-side refresh session. The production-configured APK does not offer demo sign-in.

The APK calls the public API URL from `.env.production.local`; changing that URL requires rebuilding. Product edits are written to the API's database, which must be the same database the website reads.

## Configure Cloudinary image uploads

The backend currently stores existing product images in its `images` array; the APK continues to display them. To store **new** camera/library uploads in Cloudinary:

1. This project's ignored `.env.production.local` is configured with the public Cloudinary cloud name and unsigned upload preset. If either value changes, update `VITE_CLOUDINARY_CLOUD_NAME` or `VITE_CLOUDINARY_UPLOAD_PRESET` there and rebuild with `npm run android:apk`. The values are embedded into that APK so recipients don't need to configure Cloudinary. Alternatively, enter them once in **Settings > Cloudinary image storage** on a device.
2. In a product editor, use **Take photo** or **Choose image**. Uploads go directly to Cloudinary; only the returned HTTPS image URL is sent to the authenticated JBR API and stored in the existing product record.

Unsigned presets are public, so restrict them in Cloudinary. Never put a Cloudinary API secret, Neon connection string, Twilio credential, or JWT signing secret in the app config or APK. Images are limited to JPEG, PNG, WebP, or AVIF up to 8 MB.

## Development and validation

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
npm run dev
npm run build
npm run test:api
```

Run `npm run dev:api` only when intentionally testing this project's API. Do not point production builds at it unless it has been deployed with the shared website database and private Twilio Verify configuration.

## Android build

Install Android Studio and Android SDK Platform 35 / Build-Tools 35. Set `JAVA_HOME` to JDK 21. Then:

```powershell
npm run android:apk
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. For release or Google Play, generate a signed APK/AAB in Android Studio and keep the signing key private.

## Features

- Create, edit, search, filter, publish/draft, archive, and delete products.
- Adjust stock using one-touch increment/decrement controls or enter a quantity directly.
- Take product photos with the Android camera or choose images from the library.
- Preview published products in the layout style of the public JBR storefront.
- Keep demo mode available without connecting to the live store.
