import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Clock,
  X,
  Send,
  HelpCircle,
} from 'lucide-react';

type AuthView =
  | 'signin'
  | 'signup'
  | 'signup_confirmation'
  | 'forgot_email'
  | 'forgot_code'
  | 'forgot_success'
  | 'reset_new_password';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
  canDismiss?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  canDismiss = false,
}) => {
  const {
    signInWithEmail,
    signUpWithEmail,
    resendConfirmationEmail,
    signInWithGoogle,
    sendPasswordResetOtp,
    verifyPasswordResetOtp,
    updatePassword,
    resetPasswordRecoveryState,
    isPasswordRecovery,
  } = useAuth();
  const { showToast } = useToast();

  const [view, setView] = useState<AuthView>('signin');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [otpCode, setOtpCode] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [infoMsg, setInfoMsg] = useState<string>('');
  const [isEmailUnconfirmed, setIsEmailUnconfirmed] = useState<boolean>(false);
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);

  React.useEffect(() => {
    if (isPasswordRecovery) {
      setView('reset_new_password');
    }
  }, [isPasswordRecovery]);

  if (!isOpen) return null;

  const resetForm = () => {
    setErrorMsg('');
    setInfoMsg('');
    setIsEmailUnconfirmed(false);
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
  };

  const parseAuthError = (err: any): string => {
    const rawMsg = (err?.message || '').toLowerCase();
    const code = err?.code || '';

    if (rawMsg.includes('email not confirmed') || code === 'email_not_confirmed') {
      setIsEmailUnconfirmed(true);
      return 'Your email address is not verified yet. Please click the confirmation link sent to your inbox, or click "Resend Confirmation Email" below.';
    }

    if (rawMsg.includes('invalid login credentials') || code === 'invalid_credentials') {
      return 'Incorrect email or password. Please verify your credentials and try again.';
    }

    if (rawMsg.includes('over_email_send_rate_limit') || rawMsg.includes('rate limit') || rawMsg.includes('rate_limit')) {
      return 'Supabase email rate limit reached (3-4 emails/hour on default mailer). Please wait a few minutes, or in your Supabase Dashboard toggle "Confirm email" OFF (Auth -> Providers -> Email) for instant signups.';
    }

    if (rawMsg.includes('provider is not enabled') || rawMsg.includes('unsupported provider')) {
      return 'Google Sign-In is not enabled yet in the Supabase Dashboard. Go to Authentication -> Providers -> Google to provide your OAuth Client ID and Secret.';
    }

    if (rawMsg.includes('already registered') || rawMsg.includes('user already exists') || rawMsg.includes('already exists')) {
      return 'An account with this email address already exists. Please switch to Sign In.';
    }

    return err?.message || 'Authentication failed. Please check your details and try again.';
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setIsEmailUnconfirmed(false);
    setLoading(true);

    try {
      await signInWithEmail(email, password);
      showToast('Signed in successfully!', 'success');
      onClose?.();
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setIsEmailUnconfirmed(false);
    setLoading(true);

    try {
      const result = await signUpWithEmail(email, password, name);
      if (result.needsEmailConfirmation) {
        setIsEmailUnconfirmed(true);
        setView('signup_confirmation');
      } else {
        showToast('Account created and signed in!', 'success');
        onClose?.();
      }
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      await updatePassword(password);
      resetPasswordRecoveryState();
      showToast('Password updated successfully!', 'success');
      setView('forgot_success');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email) return;
    setResendingEmail(true);
    setErrorMsg('');
    try {
      await resendConfirmationEmail(email);
      showToast('Confirmation email resent! Please check your inbox.', 'info');
      setInfoMsg(`A new confirmation email has been sent to ${email}.`);
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setResendingEmail(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
      setLoading(false);
    }
  };

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      await sendPasswordResetOtp(email);
      showToast('Verification code sent to your email! Valid for 10 minutes.', 'info');
      setView('forgot_code');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      setErrorMsg('Please enter the 6-digit verification code sent to your email.');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      // 1. Verify OTP with Supabase Auth recovery type
      await verifyPasswordResetOtp(email, otpCode.trim());
      // 2. Update user with new password
      await updatePassword(password);
      showToast('Password reset successfully! You are now authenticated.', 'success');
      setView('forgot_success');
    } catch (err: any) {
      setErrorMsg(
        err.message?.toLowerCase().includes('expired')
          ? 'Verification code has expired (valid for 10 minutes). Please request a new code.'
          : parseAuthError(err)
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header Branding */}
        <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-blue-700 px-6 py-6 text-white text-center relative">
          {canDismiss && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md mb-3 ring-1 ring-white/20">
            <Sparkles className="w-6 h-6 text-blue-200" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">TASKER</h2>
          <p className="text-xs text-blue-100 mt-1">Multi-User Personal Work & Task Tracker</p>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {/* Info Banner (e.g. email confirmation notice) */}
          {infoMsg && (
            <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{infoMsg}</span>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMsg}</span>
                {isEmailUnconfirmed && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={handleResendConfirmation}
                      disabled={resendingEmail}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold rounded text-[11px] transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      <span>{resendingEmail ? 'Sending...' : 'Resend Confirmation Email'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SIGN IN VIEW */}
          {view === 'signin' && (
            <div>
              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 mb-5">
                <button
                  type="button"
                  onClick={() => { setView('signin'); resetForm(); }}
                  className="flex-1 pb-2.5 text-sm font-semibold text-blue-600 border-b-2 border-blue-600 transition-colors"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setView('signup'); resetForm(); }}
                  className="flex-1 pb-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Create Account
                </button>
              </div>

              {/* Google OAuth Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs mb-4"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center my-4">
                <div className="flex-1 border-t border-slate-200" />
                <span className="px-3 text-xs text-slate-400 uppercase font-medium">Or with email</span>
                <div className="flex-1 border-t border-slate-200" />
              </div>

              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    <button
                      type="button"
                      onClick={() => { setView('forgot_email'); resetForm(); }}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* Helpful Hint on Email Confirmation */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>If email verification is enabled, confirm your address before sign in.</span>
              </div>
            </div>
          )}

          {/* SIGN UP VIEW */}
          {view === 'signup' && (
            <div>
              <div className="flex border-b border-slate-200 mb-5">
                <button
                  type="button"
                  onClick={() => { setView('signin'); resetForm(); }}
                  className="flex-1 pb-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setView('signup'); resetForm(); }}
                  className="flex-1 pb-2.5 text-sm font-semibold text-blue-600 border-b-2 border-blue-600 transition-colors"
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Your Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Suraj"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Password (min 6 characters)</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Sign Up'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* SIGN UP CONFIRMATION VIEW */}
          {view === 'signup_confirmation' && (
            <div className="text-center py-2 animate-in fade-in zoom-in-95 duration-200">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 mb-4 ring-8 ring-blue-50/50">
                <Mail className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1.5">Check Your Email</h3>
              <p className="text-xs text-slate-500 mb-3 max-w-xs mx-auto leading-relaxed">
                We've sent an activation link to verify your email address:
              </p>
              <div className="inline-block px-3.5 py-1.5 bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-800 mb-5 border border-slate-200 break-all">
                {email}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left mb-5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Activation Required Before Login</span>
                </div>
                <p className="text-[11px] text-amber-700 leading-relaxed pl-6">
                  Please open the confirmation email and click the verification link. If you don't see it within 2 minutes, be sure to check your <strong>Spam / Junk</strong> folder.
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setView('signin');
                    resetForm();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
                >
                  <span>I've Verified — Proceed to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendingEmail}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{resendingEmail ? 'Sending new link...' : 'Resend Verification Email'}</span>
                </button>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                <span>Want to use a different email? </span>
                <button
                  type="button"
                  onClick={() => {
                    setView('signup');
                    resetForm();
                  }}
                  className="text-blue-600 hover:underline font-semibold"
                >
                  Back to Sign Up
                </button>
              </div>
            </div>
          )}

          {/* FORGOT PASSWORD: STEP 1 - ENTER EMAIL */}
          {view === 'forgot_email' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Reset Password</h3>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Enter your registered email address. We will send you a 6-digit verification code valid for <strong>10 minutes</strong>.
              </p>

              <form onSubmit={handleRequestResetOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Registered Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      required
                      className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </button>

                <button
                  type="button"
                  onClick={() => { setView('signin'); resetForm(); }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-800 pt-2"
                >
                  Back to Sign In
                </button>
              </form>
            </div>
          )}

          {/* FORGOT PASSWORD: STEP 2 - ENTER CODE & NEW PASSWORD */}
          {view === 'forgot_code' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">Enter Verification Code</h3>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Enter the 6-digit code sent to <strong>{email}</strong> (valid for 10 minutes) and set your new password.
              </p>

              <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">6-Digit Code</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    required
                    className="w-full px-3 py-2 text-base text-center tracking-widest font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New password (min 6 characters)"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Validating & Resetting...' : 'Update Password'}
                </button>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={handleRequestResetOtp}
                    disabled={loading}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Resend Code
                  </button>
                  <button
                    type="button"
                    onClick={() => { setView('signin'); resetForm(); }}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* RESET NEW PASSWORD VIEW (FOR EMAIL LINK CALLBACK / RECOVERY) */}
          {view === 'reset_new_password' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 mb-2">
                <KeyRound className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900">Set New Password</h3>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Enter your new password to regain access to your personal TASKER workspace.
              </p>

              <form onSubmit={handleResetPasswordDirect} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password (min 6 characters)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-9 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Updating Password...' : 'Save New Password & Continue'}
                </button>
              </form>
            </div>
          )}

          {/* FORGOT PASSWORD: STEP 3 - SUCCESS */}
          {view === 'forgot_success' && (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Password Reset Complete!</h3>
              <p className="text-xs text-slate-600 mb-5">
                Your password has been securely updated. The old password will no longer work.
              </p>
              <button
                type="button"
                onClick={() => { onClose?.(); setView('signin'); resetForm(); }}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
              >
                Go to TASKER
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
