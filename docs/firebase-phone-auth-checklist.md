# Firebase Phone Auth Checklist

Use this checklist before debugging runtime OTP issues:

- Enable `Phone` in Firebase Authentication sign-in methods.
- Add every active hostname to Authorized Domains.
- Verify the web app uses the same Firebase project as the Admin SDK.
- Confirm all required web env vars exist:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- Confirm Admin SDK credentials exist or `applicationDefault()` is valid:
  - `FIREBASE_ADMIN_PROJECT_ID`
  - `FIREBASE_ADMIN_CLIENT_EMAIL`
  - `FIREBASE_ADMIN_PRIVATE_KEY`
- Review Firebase Auth usage and SMS quota limits for the current project.
- Confirm the target region is allowed for phone authentication.
- Check browser blockers:
  - ad blockers
  - blocked third-party scripts
  - broken reCAPTCHA loading
- If App Check is enabled, confirm it is configured for the same web app.
- Test these flows after any Firebase Console change:
  - new customer registration
  - new seller registration
  - forgot password
  - seller phone change from settings
