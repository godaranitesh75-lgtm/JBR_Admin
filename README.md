# JBR Electrical mobile catalog manager

This React + TypeScript Capacitor app edits products in the **same database used by** `https://jbr-electrical.vercel.app`. It connects to the website's existing API at `https://jbrelec.onrender.com`; it does not create a second Neon catalog. The API URL is preconfigured in `.env.production.local` for APK builds. Neon/database credentials remain private on the backend.

## Connect the APK to the live store

The website's existing Render API at `https://jbrelec.onrender.com` serves the same product database as the storefront. Its mobile catalog endpoints, `/api/auth/me`, and CORS access for the Vercel website and Android Capacitor origins have been deployed.

1. This app's ignored `.env.production.local` contains the public API base URL `https://jbrelec.onrender.com`. It is built into the APK, so a new installation won't ask recipients to configure the database/API. If the API address changes, update this file and rebuild.
2. Build the APK with `npm run android:apk`. Install it and sign in with an existing JBR account whose role is `ADMIN`. The app creates, updates, publishes, and deletes products through the existing API; the website reads the same database.

An admin password is still required at sign-in; account credentials must not be embedded in an APK shared with others.

## Configure Cloudinary image uploads

The backend currently stores existing product images in its `images` array; the APK continues to display them. To store **new** camera/library uploads in Cloudinary:

1. This project's ignored `.env.production.local` is configured with the public Cloudinary cloud name and unsigned upload preset. If either value changes, update `VITE_CLOUDINARY_CLOUD_NAME` or `VITE_CLOUDINARY_UPLOAD_PRESET` there and rebuild with `npm run android:apk`. The values are embedded into that APK so recipients don't need to configure Cloudinary. Alternatively, enter them once in **Settings > Cloudinary image storage** on a device.
2. In a product editor, use **Take photo** or **Choose image**. Uploads go directly to Cloudinary; only the returned HTTPS image URL is sent to the authenticated JBR API and stored in the existing product record.

Unsigned presets are public, so restrict them in Cloudinary. Never put a Cloudinary API secret, Neon connection string, administrator password, or JWT signing secret in the app config or APK. Images are limited to JPEG, PNG, WebP, or AVIF up to 8 MB.

## Development and validation

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
npm run dev
npm run build
npm run test:api
```

Run `npm run dev:api` only when intentionally testing this project's optional standalone Neon API; it is **not** the API used by the live JBR website or the shared production APK.

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
