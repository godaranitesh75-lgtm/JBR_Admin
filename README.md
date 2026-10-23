# JBR Electrical catalog manager

This React + TypeScript website manages products through the same API/database used by `https://jbr-electrical.vercel.app`; it does not create a second catalog. It works in desktop and mobile browsers, and can also be packaged as an Android app with Capacitor. Database credentials and administrator credentials belong only in the private API environment.

## Run and deploy the website

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. To build the static website for hosting:

```powershell
npm run build:web
npm run preview
```

The website build is written to `dist`. Vercel is configured in `vercel.json` to install with `npm ci` and build with `npm run build:web`. Add these variables in the hosting provider's **production** environment before deploying:

- `VITE_PUBLIC_API_URL`: HTTPS URL of the JBR API connected to the production catalog database.
- `VITE_LOCAL_DEMO_MODE=false`: keeps the website connected to the live API.
- `VITE_PUBLIC_CATALOG_WRITES=false`: requires administrator sign-in for catalog changes.
- `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`: optional; required for new image uploads.

Production builds fail if the live HTTPS API URL is missing, local demo mode is enabled, or public catalog writes are enabled. The API must use the same production database as the storefront. Add the deployed website's exact origin (including `https://`) to the API host's `CORS_ORIGINS` environment variable if it is not already allowed, then redeploy the API. Use the hosting provider's generated HTTPS domain or a custom domain for the production site.

For local-only testing without a deployed API, set `VITE_LOCAL_DEMO_MODE=true` in a local `.env.local` file before starting Vite. Demo catalog changes are stored only in that browser and do not sync to the live store. Never put database credentials, administrator passwords, JWT secrets, or Cloudinary API secrets in Vite environment variables.

## Production API and password sign-in setup

The website signs in to the API with an administrator email or username and password. The API source in `server/index.ts` accepts either email or username as the login identifier and implements protected catalog routes. The sign-in screen uses the registered database username when one exists and only offers registration when the API confirms that first-admin signup is available. Deploy it to the **same API/database used by the website** so authenticated edits appear on the main storefront.

Configure these private server environment variables:

- `DATABASE_URL`: the existing shared PostgreSQL connection string.
- `JWT_SECRET`: a randomly generated secret of at least 32 characters.
- `ADMIN_EMAIL` (or `ADMIN_USERNAME`) and `ADMIN_PASSWORD`: the administrator email/username and password checked by this API. Configure them only in the API host's private environment settings; **never put the password in a public repository, APK build, or client-side environment variable**. The sign-in screen fetches the configured email from the API to prefill the email field, then submits the email and password to the API. Only the email is returned; the password stays private. With no account stored yet, the first successful sign-in saves a salted password hash in `admin_credentials` and opens the admin workspace; no registration code is needed. Use HTTPS, a unique strong password, and rotate it if shared or exposed.
- `ADMIN_REGISTRATION_CODE` (optional): a randomly generated secret of at least 32 characters that enables one-time first-admin signup. Share it privately with the intended administrator; never put it in the app build or a public repository. The first successful registration creates the administrator account and closes further registration. No email provider is required. If you configure neither this code nor admin credentials, the API can still use the configured Twilio Verify sign-in.
- `ENABLE_PUBLIC_CATALOG_WRITES=false` (or unset): keep catalog routes protected by the authenticated session.
- Optional: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` to retain SMS OTP sign-in.

Apply the `admin_sessions` and `admin_credentials` tables from `schema.sql` to the shared database before deploying. To sign in, enter the configured `ADMIN_EMAIL` (or `ADMIN_USERNAME`) and `ADMIN_PASSWORD`. The first successful login stores a salted scrypt password hash in `admin_credentials`; subsequent password changes update that hash, not the API environment variable. If no account exists and you prefer to create one in the app instead, choose **Register as administrator** and provide the one-time `ADMIN_REGISTRATION_CODE`; registration is rate-limited and closes after the first account. Password sign-in and changes are rate-limited to five attempts per IP per 15 minutes. Changing the password revokes all refresh sessions; already-issued access tokens expire within 15 minutes. Credentials are sent only to the API over HTTPS and are not saved in the browser.

Open **Settings > Change administrator password**, enter the current password, then enter and confirm a new password of at least 12 characters. You will be returned to sign-in when the change succeeds. Changing the password this way does not require updating `ADMIN_PASSWORD` in the API environment because the database hash takes precedence after initialization.

The authenticated website stores its refresh session in the browser so sign-in survives page reloads. Short-lived API tokens renew automatically; signing out revokes the server-side refresh session. For a local demo with no sign-in, set `VITE_LOCAL_DEMO_MODE=true`; it will not read or write the live store API, and catalog changes stay in that browser.

Unauthenticated live catalog editing is available only as an explicit, high-risk opt-in. Set `VITE_PUBLIC_CATALOG_WRITES=true` in the website build environment and `ENABLE_PUBLIC_CATALOG_WRITES=true` on the API host to enable it; the API limits public writes to 30 requests per IP per 15 minutes. The app displays a warning, but **anyone who can reach the API can read the full catalog (including inactive products) and add, edit, or delete live products**. This in-memory rate limit is only a basic throttle, not access control, and CORS does not protect the API from non-browser clients. Do not enable this for a public-facing production service unless that exposure is acceptable. Leave both flags false for the authenticated production configuration. Local demo mode overrides the public-write build flag.

The website calls the API URL configured in the hosting environment at build time. Product edits are written to the API's database, which must be the same database the storefront reads. Demo mode ignores the API URL and never syncs its catalog with the website.

## Configure Cloudinary image uploads

The backend currently stores existing product images in its `images` array; the APK continues to display them. To store **new** camera/library uploads in Cloudinary:

1. Configure `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET` in the website host's build environment. Alternatively, enter them once in **Settings > Cloudinary image storage** in the browser.
2. In a product editor, use **Take photo** or **Choose image**. Uploads go directly to Cloudinary; only the returned HTTPS image URL is sent to the authenticated JBR API and stored in the existing product record.

Unsigned presets are public, so restrict them in Cloudinary. Never put a Cloudinary API secret, Neon connection string, Twilio credential, or JWT signing secret in the app config or APK. Images are limited to JPEG, PNG, WebP, or AVIF up to 8 MB.

## Development and validation

```powershell
npm run build:web
npm run build
npm run test:api
```

Run `npm run dev:api` only when intentionally testing this project's API. Do not point production builds at it unless it has been deployed with the shared website database and private Twilio Verify configuration.

## Optional Android app

The website remains the primary way to use the catalog manager. To package it for Android, install Android Studio and Android SDK Platform 35 / Build-Tools 35, then set `JAVA_HOME` to JDK 21:

```powershell
npm run android:apk
```

The debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. For a device-local demo build, set `VITE_LOCAL_DEMO_MODE=true` in `.env.production.local` before building. This disables live API access, requires no sign-in, and stores catalog data only on the device. For a live-store build, set it to `false` and deploy the protected API first. The APK uses the administrator username and password entered at sign-in; those credentials must be configured on the API host, not in the APK. Keep `VITE_PUBLIC_CATALOG_WRITES` and `ENABLE_PUBLIC_CATALOG_WRITES` false.

To produce a signed release APK, create a private release keystore (the command prompts for its password):

```powershell
New-Item -ItemType Directory -Path "$env:USERPROFILE\.jbr-admin" -Force
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v -storetype PKCS12 `
  -keystore "$env:USERPROFILE\.jbr-admin\release-key.p12" `
  -alias jbr_release -keyalg RSA -keysize 2048 -validity 10000
```

Provide these Gradle properties in the user-level `%USERPROFILE%\.gradle\gradle.properties` (or set them as environment variables). Replace `<your-user>` with the Windows profile directory name and use the password you entered when creating the key for both password values:

```properties
JBR_RELEASE_STORE_FILE=C:/Users/<your-user>/.jbr-admin/release-key.p12
JBR_RELEASE_STORE_PASSWORD=<private keystore password>
JBR_RELEASE_KEY_ALIAS=jbr_release
JBR_RELEASE_KEY_PASSWORD=<same private key password>
```

Keep the keystore and passwords backed up securely; do not commit them. With signing configured, run `cd android; .\gradlew.bat assembleRelease`. The signed APK is written to `android/app/build/outputs/apk/release/app-release.apk`. The signing key is permanent for app updates; use the same key for every future release.

## Features

- Create, edit, search, filter, publish/draft, archive, and delete products.
- Adjust stock using one-touch increment/decrement controls or enter a quantity directly.
- Take product photos with a mobile browser's camera or choose images from the device.
- Preview published products in the layout style of the public JBR storefront.
- Keep demo mode available without connecting to the live store.
