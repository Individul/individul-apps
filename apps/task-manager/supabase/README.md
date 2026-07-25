# Supabase setup (task-manager)

This app uses a hosted Supabase project for auth + Postgres. Follow these steps
once to provision the backend for the Vercel-native task manager.

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Once it is ready, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Put these in `.env.local` (local dev) and in the Vercel project environment
   variables (deployment). See `.env.example` for the variable names.

## 2. Run the schema migration

1. Open the **SQL Editor** in the Supabase dashboard.
2. Paste the full contents of [`migrations/0001_init.sql`](./migrations/0001_init.sql)
   and run it.
3. Verify in **Table Editor** that these tables exist: `profiles`, `tasks`,
   `tags`, `task_tags`, `comments`.

## 3. Make the workspace invite-only

1. Go to **Authentication → Providers → Email**.
2. Turn **OFF** "Enable email signups" so only users you add manually can log in.
3. Keep **magic link / email OTP** enabled so invited members can sign in with a
   one-time link (no password required).

## 4. Add the team members

1. Go to **Authentication → Users → Add user**.
2. Add the 4-5 team members by email. They receive a magic link on first login.
3. Optionally set each user's `full_name` (and `avatar_url`) in **User metadata** —
   the `handle_new_user` trigger copies it into their `profiles` row on first sign-in.

## 5. Configure redirect URLs

Go to **Authentication → URL Configuration → Redirect URLs** and add:

- Local dev: `http://localhost:3006/auth/callback`
- Production (after deploy): `https://<app>.vercel.app/auth/callback`

These must match the auth callback route the app uses; without them the magic-link
sign-in will fail to complete.
