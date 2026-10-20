# JBR Electrical mobile catalog manager

This React + TypeScript Capacitor app manages products through the same API/database used by `https://jbr-electrical.vercel.app`; it does not create a second catalog. The API URL is preconfigured in the ignored `.env.production.local` file and is embedded in APK builds. Database credentials and administrator credentials belong only in the private API environment.

## Production API and password sign-in setup

The APK signs in to the website API with an administrator email and password. The API source in `server/index.ts` accepts either email or username as the login identifier and implements protected catalog routes. Deploy it to the **same API/database used by the website** so authenticated app edits appear on the main website.

Configure these private server environment variables:

- `DATABASE_URL`: the existing shared PostgreSQL connection string.
- `JWT_SECRET`: a randomly generated secret of at least 32 characters.
- `ADMIN_EMAIL` (or `ADMIN_USERNAME`) and `ADMIN_PASSWORD`: the administrator email/username and password checked by this API. Configure them only in the API host's private environment settings; **never put the password in a public repository, APK build, or client-side environment variable**. The APK's sign-in screen submits the email and password to the API. With no account stored yet, the first successful sign-in saves a salted password hash in `admin_credentials` and opens the admin workspace; no registration code is needed. Use HTTPS, a unique strong password, and rotate it if shared or exposed.
- `ADMIN_REGISTRATION_CODE` (optional): a randomly generated secret of at least 32 characters that enables one-time first-admin signup. Share it privately with the intended administrator; never put it in the app build or a public repository. The first successful registration creates the administrator account and closes further registration. No email provider is required. If you configure neither this code nor admin credentials, the API can still use the configured Twilio Verify sign-in.
- `ENABLE_PUBLIC_CATALOG_WRITES=false` (or unset): keep catalog routes protected by the authenticated session.
- Optional: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` to retain SMS OTP sign-in.

Apply the `admin_sessions` and `admin_credentials` tables from `schema.sql` to the shared database before deploying. To start using the APK, enter the configured `ADMIN_EMAIL` (or `ADMIN_USERNAME`) and `ADMIN_PASSWORD` on its sign-in screen. The first successful login stores a salted scrypt password hash in `admin_credentials`; subsequent password changes update that hash, not the API environment variable. If no account exists and you prefer to create one in the app instead, choose **Register as administrator** and provide the one-time `ADMIN_REGISTRATION_CODE`; registration is rate-limited and closes after the first account. Password sign-in and changes are rate-limited to five attempts per IP per 15 minutes. Changing the password revokes all refresh sessions; already-issued access tokens expire within 15 minutes. Credentials are sent only to the API over HTTPS and are not saved on the device.

In the APK, open **Settings > Change administrator password**, enter the current password, then enter and confirm a new password of at least 12 characters. You will be returned to sign-in when the change succeeds. Changing the password this way does not require updating `ADMIN_PASSWORD` in the API environment because the database hash takes precedence after initialization.

The authenticated live-store build stores its refresh session on the device so sign-in survives app restarts. Short-lived API tokens renew automatically; signing out revokes the server-side refresh session. For a device-local demo build with no sign-in, set `VITE_LOCAL_DEMO_MODE=true`; it will not read or write the live store API, and catalog changes stay on that device.

Unauthenticated live catalog editing is available only as an explicit, high-risk opt-in. Set `VITE_PUBLIC_CATALOG_WRITES=true` in the APK build configuration and `ENABLE_PUBLIC_CATALOG_WRITES=true` on the API host to enable it; the API limits public writes to 30 requests per IP per 15 minutes. The app displays a warning, but **anyone who can reach the API can read the full catalog (including inactive products) and add, edit, or delete live products**. This in-memory rate limit is only a basic throttle, not access control, and CORS does not protect the API from non-browser clients. Do not enable this for a public-facing production service unless that exposure is acceptable. Leave both flags false for the authenticated production configuration. Local demo mode overrides the public-write build flag.

The live-store APK calls the public API URL from `.env.production.local`; changing that URL requires rebuilding. Product edits are written to the API's database, which must be the same database the website reads. A local demo APK ignores the API URL and never syncs its catalog with the website.

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
- Take product photos with the Android camera or choose images from the library.
- Preview published products in the layout style of the public JBR storefront.
- Keep demo mode available without connecting to the live store.
