import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  Lock,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  X,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  ShieldAlert,
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
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [infoMsg, setInfoMsg] = useState<string>('');
  const [resendingEmail, setResendingEmail] = useState<boolean>(false);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // 4-Digit Segmented OTP State
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '']);
  const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // 5-Attempt Security Tracking & 60s Lockout
  const [attemptsLeft, setAttemptsLeft] = useState<number>(5);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

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

  // Lockout countdown ticker
  useEffect(() => {
    if (lockoutSeconds > 0) {
      const timer = setTimeout(() => setLockoutSeconds((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockoutSeconds === 0 && attemptsLeft === 0) {
      setAttemptsLeft(5);
      setErrorMsg('');
      setInfoMsg('Lockout expired. You may now request a fresh verification code.');
    }
  }, [lockoutSeconds, attemptsLeft]);

  if (!isOpen) return null;

  const resetForm = () => {
    setErrorMsg('');
    setInfoMsg('');
    setPassword('');
    setConfirmPassword('');
    setOtpDigits(['', '', '', '']);
    setAttemptsLeft(5);
    setLockoutSeconds(0);
  };

  const getFullOtpString = (): string => {
    return otpDigits.join('').trim();
  };

  const handleOtpDigitChange = (index: number, val: string) => {
    if (lockoutSeconds > 0) return;
    const clean = val.replace(/\D/g, '');

    // Handle Paste of multi-digit code (e.g. 4 or 6 digits)
    if (clean.length > 1) {
      const newDigits = ['', '', '', ''];
      for (let i = 0; i < 4; i++) {
        newDigits[i] = clean[i] || '';
      }
      setOtpDigits(newDigits);
      const nextFocus = Math.min(clean.length, 3);
      otpInputsRef.current[nextFocus]?.focus();
      return;
    }

    const updated = [...otpDigits];
    updated[index] = clean.slice(-1);
    setOtpDigits(updated);

    // Auto advance focus to next input
    if (clean && index < 3) {
      otpInputsRef.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputsRef.current[index - 1]?.focus();
    }
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
      return 'The verification code is invalid or has expired.';
    }

    return err?.message || 'Authentication failed. Please check your details and try again.';
  };

  // STEP 1 OF LOGIN: Validate Password & Request 4-digit Email OTP
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
      setOtpDigits(['', '', '', '']);
      setAttemptsLeft(5);
      setLockoutSeconds(0);
      setResendCooldown(60);
      setView('verify_login_otp');
      showToast('Credentials confirmed! A 4-digit security code was dispatched to your email.', 'info');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 OF LOGIN: Verify Email OTP & Establish Authenticated Session
  const handleVerifyLoginOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    const code = getFullOtpString();
    if (code.length < 4) {
      setErrorMsg('Please enter the complete 4-digit verification code.');
      return;
    }

    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      await verifyLoginOtp(email, code);
      showToast('Verification successful! Welcome to TASKER.', 'success');
      onClose?.();
    } catch (err: any) {
      const nextAttempts = attemptsLeft - 1;
      setAttemptsLeft(nextAttempts);

      if (nextAttempts <= 0) {
        setLockoutSeconds(60);
        setErrorMsg('Maximum attempts reached. Current OTP invalidated. Please wait 60s.');
        setOtpDigits(['', '', '', '']);
      } else {
        setErrorMsg(`Invalid OTP. ${nextAttempts} attempt${nextAttempts === 1 ? '' : 's'} available.`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend Login OTP
  const handleResendLoginOtp = async () => {
    if (!email || resendCooldown > 0 || lockoutSeconds > 0) return;
    setResendingEmail(true);
    setErrorMsg('');
    try {
      await resendLoginOtp(email);
      setResendCooldown(60);
      setAttemptsLeft(5);
      setOtpDigits(['', '', '', '']);
      showToast('Fresh verification code sent to your email!', 'info');
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
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      const result = await signUpWithEmail(email, password, name);
      if (result.needsEmailConfirmation) {
        setOtpDigits(['', '', '', '']);
        setResendCooldown(60);
        setView('verify_signup_otp');
        showToast('Account registered! Enter the activation code sent to your email.', 'info');
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

  // STEP 2 OF SIGNUP: Verify Activation Code
  const handleVerifySignupOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = getFullOtpString();
    if (code.length < 4) {
      setErrorMsg('Please enter the complete 4-digit activation code.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      await verifySignupOtp(email, code);
      showToast('Account activated! Welcome to TASKER.', 'success');
      onClose?.();
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD: Step 1 (Request Reset Code)
  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setErrorMsg('Please enter your account email address.');
      return;
    }
    setErrorMsg('');
    setInfoMsg('');
    setLoading(true);

    try {
      await sendPasswordResetOtp(email);
      setOtpDigits(['', '', '', '']);
      setView('forgot_code');
      showToast('Password recovery code sent to your email.', 'info');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // FORGOT PASSWORD: Step 2 (Verify Recovery Code & Set New Password)
  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = getFullOtpString();
    if (code.length < 4) {
      setErrorMsg('Please enter the complete recovery code.');
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
      await verifyPasswordResetOtp(email, code);
      await updatePassword(password);
      setView('forgot_success');
      showToast('Password updated successfully! You may now sign in.', 'success');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // PASSWORD RECOVERY VIA DIRECT EMAIL LINK
  const handleUpdatePasswordFromLink = async (e: React.FormEvent) => {
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
      setView('forgot_success');
      showToast('Your new password has been set.', 'success');
    } catch (err: any) {
      setErrorMsg(parseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-all my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Ribbon */}
        <div className="bg-slate-50 dark:bg-slate-800/60 px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">TASKER</h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Secure Work Management</p>
            </div>
          </div>

          {canDismiss && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7">
          {/* Status Banners */}
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {infoMsg && (
            <div className="mb-5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-blue-700 dark:text-blue-300 text-xs font-medium flex items-start gap-2.5 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{infoMsg}</div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 1: SIGN IN (STEP 1 - EMAIL + PASSWORD) */}
          {/* ============================================================ */}
          {view === 'signin' && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Welcome Back</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Sign in to access your personal workspace.
                </p>
              </div>

              <form onSubmit={handlePasswordSignIn} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        resetForm();
                        setView('forgot_email');
                      }}
                      className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Continue to Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setView('signup');
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 2: VERIFY LOGIN OTP (STEP 2 - HARD GATE) */}
          {/* ============================================================ */}
          {view === 'verify_login_otp' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Two-Step Verification</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Enter the 4-digit security code dispatched to <strong className="text-slate-700 dark:text-slate-200">{email}</strong>
                </p>
              </div>

              {/* Segmented 4-Digit Input */}
              <form onSubmit={handleVerifyLoginOtp} className="space-y-4">
                <div className="flex justify-center gap-3 my-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={idx === 0 ? 4 : 1}
                      disabled={loading || lockoutSeconds > 0}
                      value={otpDigits[idx]}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-13 h-14 text-center text-xl font-bold font-mono bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all disabled:opacity-40"
                    />
                  ))}
                </div>

                {/* Lockout Banner or Attempts Counter */}
                {lockoutSeconds > 0 ? (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs text-center font-medium flex items-center justify-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
                    <span>Locked out: wait <strong>{lockoutSeconds}s</strong> before requesting code.</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                    <span>Attempts remaining: <strong className="text-slate-700 dark:text-slate-200">{attemptsLeft}/5</strong></span>
                    {resendCooldown > 0 ? (
                      <span className="text-slate-400">Resend in {resendCooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendLoginOtp}
                        disabled={resendingEmail || lockoutSeconds > 0}
                        className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                      >
                        Resend Code
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || lockoutSeconds > 0 || getFullOtpString().length < 4}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Verify & Enter TASKER</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setView('signin');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Credentials</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 3: SIGN UP */}
          {/* ============================================================ */}
          {view === 'signup' && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Create Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Register for an isolated, personal workspace.
                </p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Password (min 6 chars)
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="new-password"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Create Account & Send Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-2 text-center border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setView('signin');
                    }}
                    className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 4: VERIFY SIGNUP OTP */}
          {/* ============================================================ */}
          {view === 'verify_signup_otp' && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-xs">
                  <Mail className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Activate Your Account</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Enter the 4-digit code dispatched to <strong className="text-slate-700 dark:text-slate-200">{email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifySignupOtp} className="space-y-4">
                <div className="flex justify-center gap-3 my-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <input
                      key={idx}
                      ref={(el) => {
                        otpInputsRef.current[idx] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={idx === 0 ? 4 : 1}
                      disabled={loading}
                      value={otpDigits[idx]}
                      onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-13 h-14 text-center text-xl font-bold font-mono bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:border-emerald-500 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 px-1">
                  <span>Activation code sent</span>
                  {resendCooldown > 0 ? (
                    <span className="text-slate-400">Resend in {resendCooldown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await resendConfirmationEmail(email);
                          setResendCooldown(60);
                          showToast('New activation code sent!', 'info');
                        } catch (err: any) {
                          setErrorMsg(parseAuthError(err));
                        }
                      }}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                    >
                      Resend Code
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || getFullOtpString().length < 4}
                  className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-50"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Activate Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setView('signin');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 5: FORGOT PASSWORD - REQUEST EMAIL */}
          {/* ============================================================ */}
          {view === 'forgot_email' && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Reset Password</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter your email address to receive a recovery code.
                </p>
              </div>

              <form onSubmit={handleRequestPasswordReset} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@company.com"
                      required
                      autoComplete="email"
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send Recovery Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      resetForm();
                      setView('signin');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 6: FORGOT PASSWORD - CODE & NEW PASSWORD */}
          {/* ============================================================ */}
          {view === 'forgot_code' && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Set New Password</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter the recovery code sent to <strong className="text-slate-700 dark:text-slate-200">{email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerifyAndResetPassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Recovery Code
                  </label>
                  <div className="flex justify-center gap-3 my-2">
                    {[0, 1, 2, 3].map((idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          otpInputsRef.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={idx === 0 ? 6 : 1}
                        value={otpDigits[idx]}
                        onChange={(e) => handleOtpDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="w-13 h-14 text-center text-xl font-bold font-mono bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:border-blue-500 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || getFullOtpString().length < 4}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Reset Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 7: FORGOT PASSWORD - SUCCESS */}
          {/* ============================================================ */}
          {view === 'forgot_success' && (
            <div className="text-center py-4 space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 mb-2">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Password Reset Complete</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Your password has been successfully updated. You can now sign in using your new credentials.
              </p>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setView('signin');
                }}
                className="w-full mt-4 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md transition-colors"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {/* ============================================================ */}
          {/* VIEW 8: RESET NEW PASSWORD (FROM DIRECT EMAIL LINK) */}
          {/* ============================================================ */}
          {view === 'reset_new_password' && (
            <div className="space-y-4">
              <div className="mb-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Set New Password</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter your new password below to complete account recovery.
                </p>
              </div>

              <form onSubmit={handleUpdatePasswordFromLink} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Save New Password</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
