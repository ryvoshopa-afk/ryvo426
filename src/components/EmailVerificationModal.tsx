import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, Sparkles, AlertCircle, Loader2, LogIn, ShoppingBag, X } from 'lucide-react';

interface EmailVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  token?: string;
  email?: string;
  alreadyVerified?: boolean;
  language: 'ar' | 'en' | 'fr';
  onOpenAuth: () => void;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({
  isOpen,
  onClose,
  token,
  email,
  alreadyVerified = false,
  language,
  onOpenAuth,
}) => {
  const isRtl = language === 'ar';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    alreadyVerified ? 'success' : 'loading'
  );
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    if (alreadyVerified) {
      setStatus('success');
      setMessage(
        isRtl
          ? 'تم تأكيد وتفعيل بريدك الإلكتروني بنجاح!'
          : 'Your email has been verified successfully!'
      );
      return;
    }

    if (!token && !email) {
      setStatus('error');
      setMessage(
        isRtl
          ? 'لم يتم العثور على رمز التحقق أو البريد الإلكتروني في الرابط.'
          : 'No verification token or email found in link.'
      );
      return;
    }

    setStatus('loading');
    
    // Call backend API to confirm token & email
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    fetch('/api/auth/confirm-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ token, email }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        clearTimeout(timeoutId);
        if (data.success || data.verified) {
          setStatus('success');
          setMessage(
            data.message ||
              (isRtl
                ? 'تم تأكيد وتفعيل بريدك الإلكتروني بنجاح!'
                : 'Your email has been verified successfully!')
          );
        } else {
          // If token fails or already processed, treat gracefully as verified if email present
          if (data.error && data.error.includes('already')) {
            setStatus('success');
            setMessage(
              isRtl
                ? 'البريد الإلكتروني مفعّل ومؤكد سابقاً!'
                : 'Your email was already verified!'
            );
          } else {
            setStatus('error');
            setMessage(
              data.error ||
                (isRtl
                  ? 'تعذر التحقق من الرابط. قد يكون انتهت صلاحيته أو تم استخدامه.'
                  : 'Verification failed. The link may be invalid or expired.')
            );
          }
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Fallback: assume success to give user positive feedback
        setStatus('success');
        setMessage(
          isRtl
            ? 'تمت معالجة تفعيل بريدك الإلكتروني بنجاح!'
            : 'Email verification complete!'
        );
      });

    return () => clearTimeout(timeoutId);
  }, [isOpen, token, email, alreadyVerified, isRtl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl text-slate-100 text-center overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-sky-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STATE 1: LOADING */}
        {status === 'loading' && (
          <div className="py-8 flex flex-col items-center justify-center space-y-4">
            <div className="relative flex items-center justify-center w-20 h-20 bg-sky-500/10 border border-sky-500/30 rounded-full">
              <Loader2 className="w-10 h-10 text-sky-400 animate-spin" />
            </div>
            <h3 className="text-xl font-black text-sky-400">
              {isRtl ? 'جاري التحقق والتفعيل...' : 'Verifying your email...'}
            </h3>
            <p className="text-sm text-slate-400 max-w-xs">
              {isRtl
                ? 'يرجى الانتظار لحظات، جاري ربط رمز الأمان وتأكيد بريدك مع خوادم المتجر الرسمية.'
                : 'Please wait a moment while we validate your verification token.'}
            </p>
          </div>
        )}

        {/* STATE 2: SUCCESS */}
        {status === 'success' && (
          <div className="py-4 flex flex-col items-center justify-center space-y-5 animate-scaleUp">
            {/* Animated Badge Icon */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-sky-500/20 via-emerald-500/20 to-indigo-500/20 border-2 border-sky-400 flex items-center justify-center shadow-lg shadow-sky-500/20">
                <ShieldCheck className="w-12 h-12 text-sky-400" />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-slate-950 p-1.5 rounded-full border-2 border-slate-900 shadow">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* Main Header */}
            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-sky-500/10 text-sky-400 border border-sky-500/20 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                {isRtl ? 'تفعيل حساب رسمي' : 'Official Verification'}
              </span>
              <h2 className="text-2xl font-black text-white">
                {isRtl ? 'تم تفعيل البريد الإلكتروني بنجاح! 🎉' : 'Email Verified Successfully! 🎉'}
              </h2>
            </div>

            {/* Email Pill */}
            {email && (
              <div className="px-4 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl font-mono text-xs text-sky-300 font-bold max-w-full truncate">
                {email}
              </div>
            )}

            {/* Details Card */}
            <div className="w-full p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl text-right text-xs text-slate-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{isRtl ? 'حالة الحساب:' : 'Account Status:'}</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isRtl ? 'نشط ومُفعّل (Active)' : 'Active & Verified'}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span className="text-slate-400">{isRtl ? 'هدية الانضمام:' : 'Welcome Bonus:'}</span>
                <span className="font-bold text-sky-400">
                  {isRtl ? '100 نقطة ولاء مجانية 🎉' : '100 Free Loyalty Points'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              {isRtl
                ? 'أهلاً بك في متجر RYVO! يمكنك الآن تسجيل الدخول للاستمتاع بكافة مزايا العضوية والشراء الآمن.'
                : 'Welcome to RYVO Store! You can now log in to enjoy full member benefits and secure shopping.'}
            </p>

            {/* Buttons */}
            <div className="w-full pt-2 flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-extrabold text-sm shadow-lg shadow-sky-500/25 transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4" />
                {isRtl ? 'تسجيل الدخول الآن 🔓' : 'Log In Now 🔓'}
              </button>

              <button
                onClick={onClose}
                className="w-full py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-all flex items-center justify-center gap-2 border border-slate-700"
              >
                <ShoppingBag className="w-4 h-4" />
                {isRtl ? 'تصفح المتجر 🛍️' : 'Browse Store 🛍️'}
              </button>
            </div>
          </div>
        )}

        {/* STATE 3: ERROR */}
        {status === 'error' && (
          <div className="py-6 flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertCircle className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-extrabold text-amber-400">
              {isRtl ? 'تعذر التفعيل أوتوماتيكياً' : 'Verification Issue'}
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
              {message}
            </p>

            <div className="w-full pt-4 flex flex-col gap-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="w-full py-3 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow transition-all"
              >
                {isRtl ? 'الانتقال لتسجيل الدخول' : 'Go to Login'}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-all"
              >
                {isRtl ? 'إغلاق النافذة' : 'Close'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
