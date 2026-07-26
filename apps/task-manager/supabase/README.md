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

## 2b. Roluri

Autorizarea pe roluri (`admin` / `member`) e definită în
[`migrations/0002_roles.sql`](./migrations/0002_roles.sql).

1. În **SQL Editor**, rulează `migrations/0002_roles.sql` **DUPĂ**
   `0001_init.sql`, apoi `migrations/0005_role_guard_service_context.sql`.
   `0002` adaugă coloana `role`, politicile RLS și trigger-ul `profiles_role_guard`
   (doar un admin poate schimba roluri); `0005` corectează gărzile ca să blocheze
   doar userii **autentificați** non-admin — altfel trigger-ul blochează chiar și
   bootstrap-ul din SQL Editor (unde `auth.uid()` e null).
2. **Bootstrap primul admin.** Deoarece încă nu există niciun admin care să
   promoveze pe cineva din UI, setează manual primul administrator (merge direct
   după ce ai aplicat `0005`):

   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'emailul-tău');
   ```

   > Dacă nu ai aplicat `0005`, dezactivează temporar trigger-ul în jurul update-ului:
   > `alter table profiles disable trigger profiles_role_guard;` … update … apoi
   > `alter table profiles enable trigger profiles_role_guard;`

3. După bootstrap, promovările/retrogradările ulterioare se fac în aplicație la
   [`/admin`](../README.md#roluri) — nu mai e nevoie de SQL manual.

## 2c. Username

Pentru a permite login cu **username** (pe lângă email), rulează
[`migrations/0003_username.sql`](./migrations/0003_username.sql) **DUPĂ**
`0002_roles.sql`. Adaugă coloana `username` (unică, case-insensitive) și funcția
`email_for_login`, care rezolvă username→email la autentificare (apelabilă de rolul
`anon`, fiindcă login-ul se face neautentificat).

Userii își setează singuri username-ul din aplicație („Profilul meu"). Login-ul
acceptă email **sau** username + parolă.

## 2d. Etichete (creare doar de admin)

Rulează [`migrations/0004_tags_admin_only.sql`](./migrations/0004_tags_admin_only.sql)
**DUPĂ** `0002_roles.sql`. Doar adminul poate crea/modifica/șterge etichete; toți
utilizatorii le pot citi și atașa pe sarcini.

## 3. Make the workspace invite-only (email + password)

1. Go to **Authentication → Providers → Email**.
2. Make sure the **Email** provider is **enabled** (password sign-in is on by default).
3. Turn **OFF** "Enable email signups" so only users you add manually can log in.
   Signing IN existing users with a password still works with signups off.

## 4. Add the team members (with passwords)

1. Go to **Authentication → Users → Add user**.
2. Add the 4-5 team members by email, **set a password for each**, and enable
   **"Auto Confirm User"** so they can sign in immediately.
3. Optionally set each user's `full_name` (and `avatar_url`) in **User metadata** —
   the `handle_new_user` trigger copies it into their `profiles` row on first sign-in.
4. Users can change their own password later from the app ("Schimbă parola" in the
   top-right of the tasks page).

## 5. Redirect URLs (optional)

Email + password login does **not** require redirect URLs. If you later add a
password-reset or magic-link flow (which go through `/auth/callback`), configure
**Authentication → URL Configuration → Redirect URLs**:

- Local dev: `http://localhost:3006/auth/callback`
- Production: `https://<app>.vercel.app/auth/callback`
