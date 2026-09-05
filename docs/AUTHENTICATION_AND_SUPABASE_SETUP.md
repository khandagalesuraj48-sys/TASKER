# TASKER: Production Authentication & Supabase Setup Guide

This guide details the exact setup steps in the **Supabase Dashboard** and **Google Cloud Console** required for TASKER multi-user production authentication.

---

## 1. Google OAuth Configuration

The TASKER application code uses the official Supabase OAuth implementation:
```typescript
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://mytasker-dun.vercel.app'
  }
});
```

When Google Sign-In returns `Unsupported provider: provider is not enabled`, it means the Google provider has not yet been enabled in the Supabase Dashboard. Follow these steps to activate it:

### Step 1: Create Google OAuth 2.0 Credentials in Google Cloud Console
1. Open the [Google Cloud Console Credentials Page](https://console.cloud.google.com/apis/credentials).
2. Select your Google Cloud Project (or create a new one named `TASKER`).
3. If not already done, configure the **OAuth consent screen**:
   - User Type: **External**
   - App Name: `TASKER`
   - User support email: Select your email
   - Developer contact email: Enter your email
   - Click **Save and Continue** through the scopes and test users.
4. Go to **Credentials** -> Click **+ CREATE CREDENTIALS** -> Select **OAuth client ID**.
5. Set Application Type: **Web application**.
6. Name: `TASKER Web & Android Client`.
7. Under **Authorized JavaScript origins**, add:
   - `https://mytasker-dun.vercel.app`
   - `https://xargfforwknnicudigxs.supabase.co`
   - `http://localhost:5173` (for local development)
8. Under **Authorized redirect URIs**, add the exact Supabase OAuth callback URL:
   - `https://xargfforwknnicudigxs.supabase.co/auth/v1/callback`
9. Click **Create**.
10. Copy your **Client ID** (e.g. `123456789-...apps.googleusercontent.com`) and **Client Secret**.

### Step 2: Enable Google in Supabase Dashboard
1. Open your [Supabase Project Auth Providers](https://supabase.com/dashboard/project/xargfforwknnicudigxs/auth/providers).
2. Find and click **Google** to expand its settings.
3. Toggle **Enable Google provider** to **ON**.
4. Paste the **Client ID** and **Client Secret** copied from Step 1.
5. Click **Save**.

### Step 3: Configure URL Configuration in Supabase
1. In the Supabase Dashboard, go to **Authentication** -> **URL Configuration**:
   `https://supabase.com/dashboard/project/xargfforwknnicudigxs/auth/url-configuration`
2. Set **Site URL** to:
   `https://mytasker-dun.vercel.app`
3. Under **Redirect URLs**, ensure the following patterns are listed:
   - `https://mytasker-dun.vercel.app/**`
   - `http://localhost:5173/**`
4. Click **Save**.

---

## 2. Email Confirmation Setting (Instant Login vs Email Verification)

In Supabase Auth, you have two modes for Email/Password registration:

### Option A: Instant Registration & Sign-In (Recommended for fast onboarding)
If you want users to immediately sign in upon account creation without waiting for or clicking a confirmation email:
1. Go to [Supabase Auth Providers -> Email](https://supabase.com/dashboard/project/xargfforwknnicudigxs/auth/providers).
2. Find the **Confirm email** toggle.
3. Toggle **Confirm email** to **OFF** (Disabled).
4. Click **Save**.

*Benefit*: Eliminates the Supabase free-tier SMTP rate limit (3-4 emails/hour), and users start using TASKER immediately after signup.

### Option B: Require Email Confirmation
If you want users to verify their email address before accessing the app:
1. Ensure **Confirm email** is toggled to **ON** in [Supabase Auth Providers -> Email](https://supabase.com/dashboard/project/xargfforwknnicudigxs/auth/providers).
2. TASKER displays a dedicated **Activation Screen** after signup with the user's email, instructions to check their spam folder, and a "Resend Verification Email" button.
3. If testing frequently, note that Supabase's built-in mailer has a limit of ~3-4 emails per hour. For production with high volume, configure a custom SMTP provider (Resend, SendGrid, Amazon SES, or Brevo) under **Project Settings** -> **Auth** -> **SMTP Settings**.

---

## 3. Forgot Password Flow

TASKER supports both methods of password recovery:
1. **6-Digit Verification Code (OTP)**:
   - The user requests a reset code.
   - Supabase sends an email containing the 6-digit recovery code.
   - The user enters the code and their new password in TASKER.
   - `verifyOtp({ email, token, type: 'recovery' })` validates the token and updates the password.
2. **Email Recovery Link Callback**:
   - If the user clicks the password reset link inside the email, Supabase redirects them back to `https://mytasker-dun.vercel.app/#access_token=...&type=recovery`.
   - TASKER detects the `PASSWORD_RECOVERY` event and automatically presents the **Set New Password** screen.

---

## 4. Legacy Data Assignment to Owner Account

All legacy data in production (4 tasks, 12 status histories, 1 note, 2 attachments) is safely preserved with `user_id IS NULL`. Under PostgreSQL RLS, **new users see 0 tasks**.

Once the owner account has been registered (via Email or Google), link the legacy data to your account by running this single query in the [Supabase SQL Editor](https://supabase.com/dashboard/project/xargfforwknnicudigxs/sql/new):

```sql
SELECT public.assign_legacy_data_to_owner('your_registered_email@example.com');
```

*This securely assigns all 4 tasks and their related records to your user UUID without exposing any secrets in frontend code.*

---

## 5. Multi-User & Realtime Verification Summary

- **User Isolation**: PostgreSQL RLS policies enforce `user_id = auth.uid()` on all tables and storage objects.
- **Realtime Sync**: When a task or status is updated on Android or another browser tab, Supabase Realtime emits `postgres_changes` over WebSocket to the channel `tasker-realtime-${userId}`, immediately refreshing the web client.
- **Account Switching**: Calling `signOut` unmounts the entire app layout, destroys component state, clears search filters, and disconnects the user-scoped WebSocket channel.

