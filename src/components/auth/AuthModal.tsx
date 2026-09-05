import React, { useState, useEffect } from 'react';
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
  ShieldCheck,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';

type AuthView =
  | 'signin'
  | 'verify_login_otp'
  | 'signup'
  | 'verify_signup_otp'
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
    validatePasswordAndSendOtp,
    verifyLoginOtp,
    resendLoginOtp,
    verifySignupOtp,
    signUpWithEmail,
    resendConfirmationEmail,
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
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Automatically switch to password reset view if user entered via an email recovery link
  useEffect(() => {
    if (isPasswordRecovery) {
      setView('reset_new_password');
    }
  }, [isPasswordRecovery]);

  // Resend cooldown countdown ticker
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  if (!isOpen) return null;

  const resetForm = () => {
    setErrorMsg('');
    setInfoMsg('');
    setPassword('');
    setConfirmPassword('');
    setOtpCode('');
  };

  const parseAuthError = (err: any): string => {
    const rawMsg = (err?.message || '').toLowerCase();
    const code = err?.code || '';

    if (rawMsg.includes('email not confirmed') || code === 'email_not_confirmed') {
      return 'Your email address is not verified yet. Please check your inbox for the activation code.';
    }

    if (rawMsg.includes('invalid login credentials') || code === 'invalid_credentials') {
      return 'Incorrect email or password. Please verify your credentials and try again.';
    }

    if (
      rawMsg.includes('over_email_send_rate_limit') ||
      rawMsg.includes('rate limit') ||
      rawMsg.includes('rate_limit')
    ) {
      return 'Email rate limit reached. Please wait a minute before requesting another code.';
    }

    if (
      rawMsg.includes('already registered') ||
      rawMsg.includes('user already exists') ||
      rawMsg.includes('already exists')
    ) {
      return 'An account with this email address already exists. Please switch to Sign In.';
    }

    if (
      rawMsg.includes('token has expired') ||
      rawMsg.includes('invalid') ||
      code === 'otp_expired'
    ) {
      return 'The verification code is invalid or has expired. Please check the code or request a new one.';
    }

    return err?.message || 'Authentication failed. Please check your details and try again.';
  };

  // STEP 1 OF LOGIN: Validate Password & Request Email OTP
  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      await validatePasswordAndSendOtp(email, password);
      setOtpCode('');
      setResendCooldown(60);
      setView('verify_login_otp');
      showToast('Password verified! A 6-digit security code was sent to your email.', 'info');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 OF LOGIN: Verify Email OTP & Establish Authenticated Session
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      await verifyLoginOtp(email, otpCode.trim());
      showToast('Signed in successfully!', 'success');
      onClose?.();
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Resend Login OTP
  const handleResendLoginOtp = async () => {
    if (!email || resendCooldown > 0) return;
    setResendingEmail(true);
    setErrorMsg('');
    try {
      await resendLoginOtp(email);
      setResendCooldown(60);
      showToast('New verification code sent to your email!', 'info');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setResendingEmail(false);
    }
  };

  // STEP 1 OF SIGNUP: Create Account & Send Activation OTP
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
    setLoading(true);

    try {
      const result = await signUpWithEmail(email, password, name);
      if (result.needsEmailConfirmation) {
        setOtpCode('');
        setResendCooldown(60);
        setView('verify_signup_otp');
        showToast('Account created! Please enter the 6-digit verification code.', 'info');
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

  // STEP 2 OF SIGNUP: Verify Activation Code & Activate Account
  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      await verifySignupOtp(email, otpCode.trim());
      showToast('Account activated! Welcome to TASKER.', 'success');
      onClose?.();
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Resend Signup Activation Code
  const handleResendSignupCode = async () => {
    if (!email || resendCooldown > 0) return;
    setResendingEmail(true);
    setErrorMsg('');
    try {
      await resendConfirmationEmail(email);
      setResendCooldown(60);
      showToast('New activation code sent to your email!', 'info');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setResendingEmail(false);
    }
  };

  // FORGOT PASSWORD: Step 1 Request Code
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
      setOtpCode('');
      setResendCooldown(60);
      showToast('Password reset code sent to your email! Valid for 10 minutes.', 'info');
      setView('forgot_code');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD: Step 2 Verify Code & Set Password
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
      await verifyPasswordResetOtp(email, otpCode.trim());
      await updatePassword(password);
      showToast('Password reset successfully! You are now authenticated.', 'success');
      setView('forgot_success');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD: Link Callback Set New Password
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
          {/* Info Banner */}
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
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 1: SIGN IN (EMAIL + PASSWORD) */}
          {/* ============================================================ */}
          {view === 'signin' && (
            <div>
              {/* Tab Selector */}
              <div className="flex border-b border-slate-200 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setView('signin');
                    resetForm();
                  }}
                  className="flex-1 pb-2.5 text-sm font-semibold text-blue-600 border-b-2 border-blue-600 transition-colors"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('signup');
                    resetForm();
                  }}
                  className="flex-1 pb-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handlePasswordSignIn} className="space-y-4">
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
                      onClick={() => {
                        setView('forgot_email');
                        resetForm();
                      }}
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
                  {loading ? 'Verifying Credentials...' : 'Continue to Verification'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>Two-step security: A one-time verification code is required on every login.</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 2: VERIFY LOGIN EMAIL OTP */}
          {/* ============================================================ */}
          {view === 'verify_login_otp' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 text-blue-600 mb-2">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Two-Step Verification</h3>
                <p className="text-xs text-slate-500 mt-1">
                  We sent a single-use 6-digit code to:
                </p>
                <div className="inline-block mt-1.5 px-3 py-1 bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-800 border border-slate-200 break-all">
                  {email}
                </div>
              </div>

              <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    className="w-full px-3 py-2.5 text-center tracking-[0.35em] text-lg font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Validating Security Code...' : 'Verify & Enter TASKER'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleResendLoginOtp}
                    disabled={resendingEmail || resendCooldown > 0}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resendingEmail ? 'animate-spin' : ''}`} />
                    <span>
                      {resendCooldown > 0
                        ? `Resend code in ${resendCooldown}s`
                        : resendingEmail
                        ? 'Sending...'
                        : 'Resend Code'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setView('signin');
                      resetForm();
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Back to Sign In
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 3: CREATE ACCOUNT (NAME + EMAIL + PASSWORD) */}
          {/* ============================================================ */}
          {view === 'signup' && (
            <div>
              <div className="flex border-b border-slate-200 mb-5">
                <button
                  type="button"
                  onClick={() => {
                    setView('signin');
                    resetForm();
                  }}
                  className="flex-1 pb-2.5 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView('signup');
                    resetForm();
                  }}
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password (min 6 characters)
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:opacity-50"
                >
                  {loading ? 'Creating Account...' : 'Continue to Activation'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] text-slate-400">
                <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                <span>An activation code will be sent to your email to verify account ownership.</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 4: VERIFY SIGNUP ACTIVATION OTP */}
          {/* ============================================================ */}
          {view === 'verify_signup_otp' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 mb-2">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Activate Your Account</h3>
                <p className="text-xs text-slate-500 mt-1">
                  We sent a 6-digit activation code to:
                </p>
                <div className="inline-block mt-1.5 px-3 py-1 bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-800 border border-slate-200 break-all">
                  {email}
                </div>
              </div>

              <form onSubmit={handleVerifySignupOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 text-center">
                    Enter Activation Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    className="w-full px-3 py-2.5 text-center tracking-[0.35em] text-lg font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Activating Account...' : 'Activate & Enter TASKER'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleResendSignupCode}
                    disabled={resendingEmail || resendCooldown > 0}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resendingEmail ? 'animate-spin' : ''}`} />
                    <span>
                      {resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : resendingEmail
                        ? 'Sending...'
                        : 'Resend Code'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setView('signup');
                      resetForm();
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Back to Sign Up
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 5: FORGOT PASSWORD - STEP 1 (ENTER EMAIL) */}
          {/* ============================================================ */}
          {view === 'forgot_email' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Reset Password</h3>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Enter your registered email address. We will send you a 6-digit recovery code valid for{' '}
                <strong>10 minutes</strong>.
              </p>

              <form onSubmit={handleRequestResetOtp} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Registered Email
                  </label>
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
                  {loading ? 'Sending Code...' : 'Send Recovery Code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setView('signin');
                    resetForm();
                  }}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-800 pt-2"
                >
                  Back to Sign In
                </button>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 6: FORGOT PASSWORD - STEP 2 (ENTER CODE & NEW PASSWORD) */}
          {/* ============================================================ */}
          {view === 'forgot_code' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900">Enter Recovery Code</h3>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Enter the 6-digit code sent to <strong>{email}</strong> and set your new password.
              </p>

              <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    6-Digit Recovery Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    required
                    className="w-full px-3 py-2 text-base text-center tracking-widest font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password
                  </label>
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Validating & Resetting...' : 'Update Password'}
                </button>

                <div className="flex justify-between items-center pt-2">
                  <button
                    type="button"
                    onClick={handleRequestResetOtp}
                    disabled={loading || resendCooldown > 0}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setView('signin');
                      resetForm();
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 7: RESET NEW PASSWORD (DIRECT EMAIL LINK RECOVERY) */}
          {/* ============================================================ */}
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

          {/* ============================================================ */}
          {/* VIEW 8: FORGOT PASSWORD - SUCCESS */}
          {/* ============================================================ */}
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
                onClick={() => {
                  onClose?.();
                  setView('signin');
                  resetForm();
                }}
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
