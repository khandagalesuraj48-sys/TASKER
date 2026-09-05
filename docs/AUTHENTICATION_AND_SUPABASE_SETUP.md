# TASKER: Production Authentication & Security Setup Guide

This document specifies the authentication architecture and setup instructions for TASKER multi-user production deployment.

---

## 1. Authentication Architecture

TASKER enforces a strict **Two-Step Authentication** model on every login session:

1. **Step 1: Credential Verification (Email + Password)**
   - The user enters their registered email and password.
   - Credentials are electronically validated against Supabase Auth.
   - If invalid, the request is rejected immediately with an error and **no OTP is generated or sent**.
   - If valid, a session challenge is initiated in the database with status `is_verified = FALSE`.

2. **Step 2: Fresh Single-Use Email OTP Challenge**
   - A single-use 6-digit verification code is securely dispatched to the user's verified email address.
   - The user inputs the 6-digit code.
   - Once validated, the session is marked verified (`is_verified = TRUE`), and the authenticated TASKER dashboard loads.
   - There is no "remember this device" bypass. Every new sign-in session must satisfy both steps.

3. **Database RLS Boundary Enforcement (Migration 005)**
   - Even if an attacker obtains a user's password, calling `signInWithPassword` directly without the UI will yield a session where `public.is_session_otp_verified()` is `FALSE`.
   - Under PostgreSQL Row Level Security (RLS), all queries to `tasks`, `task_status_history`, `task_notes`, `task_attachments`, and `task_reminders` return **0 rows** until the OTP challenge is completed.
   - Google Sign-In has been **completely excised** from both UI and authentication logic.

---

## 2. Applying Database Migration 005

To activate database-level OTP session enforcement in Supabase:

1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/xargfforwknnicudigxs/sql/new).
2. Open the file `supabase/migrations/005_mandatory_email_otp_rls.sql` from this repository.
3. Paste its contents into the SQL Editor and click **Run**.

### What Migration 005 Implements:
- Creates `public.user_otp_sessions` mapping user sessions to verification status.
- Implements `public.is_session_otp_verified()` (`STABLE SECURITY DEFINER`).
- Implements `public.initiate_login_challenge()`, `public.complete_login_challenge()`, and `public.revoke_login_challenge()`.
- Updates Row Level Security policies across all tables:
  ```sql
  (user_id = auth.uid() AND public.is_session_otp_verified())
  ```
- Updates `search_tasks_universal` and storage object security for `task-attachments`.

---

## 3. Email Provider & Confirmation Settings

In Supabase Auth, verify your Email provider settings:

1. Go to [Supabase Auth Providers -> Email](https://supabase.com/dashboard/project/xargfforwknnicudigxs/auth/providers).
2. Ensure **Email** provider is toggled to **ON**.
3. Under **Confirm email**:
   - If toggled **ON**: New users will be directed to the activation screen to enter the 6-digit signup OTP sent to their inbox before their first login.
   - If toggled **OFF**: New accounts are activated immediately upon signup.
4. For high-volume production, configure custom SMTP (Resend, SendGrid, Amazon SES, or Brevo) under **Project Settings** -> **Auth** -> **SMTP Settings** to avoid default rate limits.

---

## 4. Forgot Password Flow

TASKER supports both recovery paths:
1. **6-Digit Recovery OTP**:
   - The user enters their email on the "Forgot Password" screen.
   - Supabase sends a 6-digit recovery code.
   - The user enters the code and their new password in TASKER.
   - `verifyOtp({ email, token, type: 'recovery' })` validates the token and updates the password immediately.
2. **Password Reset Email Link**:
   - Clicking the password reset link inside the email brings the user to the reset screen automatically via the `PASSWORD_RECOVERY` auth event.

---

## 5. Legacy Data Assignment to Owner Account

All legacy data in production (4 tasks, 12 status histories, 1 note, 2 attachments) is safely preserved with `user_id IS NULL`. Under PostgreSQL RLS, **new users see 0 tasks**.

Once the owner account has been registered, assign the legacy data to your account by running this query in the [Supabase SQL Editor](https://supabase.com/dashboard/project/xargfforwknnicudigxs/sql/new):

```sql
SELECT public.assign_legacy_data_to_owner('your_registered_email@example.com');
```

*This securely assigns all 4 legacy tasks and their related records to your user UUID without exposing any secrets in frontend code.*

---

## 6. Multi-User & Realtime Verification Summary

- **User Isolation**: PostgreSQL RLS policies enforce `user_id = auth.uid()` on all tables and storage objects.
- **Realtime Sync**: When a task or status is updated on Android or another browser tab, Supabase Realtime emits `postgres_changes` over WebSocket to the channel `tasker-realtime-${userId}`, immediately refreshing the web client.
- **Account Switching**: Calling `signOut` unmounts the entire app layout, destroys component state, clears search filters, and disconnects the user-scoped WebSocket channel.

