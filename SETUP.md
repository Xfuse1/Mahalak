# Setup Guide

## Firebase (Auth + Firestore)

1. Update `.env.local` with `NEXT_PUBLIC_FIREBASE_*` keys (already added).
2. Enable **Email/Password** in Firebase Auth.
3. Create a Firestore database (Native mode).
4. Add Admin credentials for server actions:
   - Option A: set `GOOGLE_APPLICATION_CREDENTIALS` to your service account JSON path.
   - Option B: set `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` (use `\n` for newlines).
5. Configure Firestore rules to enforce `seller/customer` access using the `role` field in `profiles`.

## Supabase Storage (Images)

1. Keep Supabase for Storage only.
2. Create a public bucket named `product-images`.
3. Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local`.

## Notes

- Server actions now use Firebase Admin; missing admin credentials will break data reads/writes.
- Run `npm install` after adding Firebase dependencies.
