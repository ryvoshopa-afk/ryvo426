import React from 'react';
import { Language, User, SimulatedEmail } from '../types';
import { TRANSLATIONS } from '../constants/translations';
import { X, ShieldAlert, Key, Mail, Sparkles, UserCheck, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

// Seeding standard registered users helper
const getRegisteredUsers = (): User[] => {
  const saved = localStorage.getItem('ryvo_registered_users');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
  }
  const defaultUsers: User[] = [
    {
      email: 'ryvo.shopa@gmail.com',
      name: 'أدمن رايفو',
      role: 'admin',
      favorites: [],
      password: '123456'
    },
    {
      email: 'customer@example.com',
      name: 'أحمد الغامدي',
      role: 'customer',
      favorites: [],
      password: '123456'
    }
  ];
  localStorage.setItem('ryvo_registered_users', JSON.stringify(defaultUsers));
  return defaultUsers;
};

const saveRegisteredUsers = (users: User[]) => {
  localStorage.setItem('ryvo_registered_users', JSON.stringify(users));
};

const sendSimulatedEmail = (to: string, subject: string, body: string) => {
  const saved = localStorage.getItem('ryvo_customer_emails');
  let emails: SimulatedEmail[] = [];
  if (saved) {
    try {
      emails = JSON.parse(saved);
    } catch (e) {
      // ignore
    }
  }
  const newEmail: SimulatedEmail = {
    id: `EMAIL-${Math.floor(1000 + Math.random() * 9000)}`,
    to: to.toLowerCase().trim(),
    subject,
    body,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    read: false
  };
  emails.unshift(newEmail);
  localStorage.setItem('ryvo_customer_emails', JSON.stringify(emails));
};

interface AuthModalProps {
  currentLanguage: Language;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export default function AuthModal({
  currentLanguage,
  onClose,
  onAuthSuccess
}: AuthModalProps) {
  const t = TRANSLATIONS[currentLanguage];
  const isRtl = currentLanguage === 'ar';

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot' | 'otp_verify'>('login');
  const [otpPurpose, setOtpPurpose] = useState<'verification' | 'reset'>('verification');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [fullname, setFullname] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setIsLoading(true);

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = otpCode.trim();

    if (!cleanCode || cleanCode.length !== 6) {
      setFeedback({ type: 'error', text: isRtl ? 'يرجى إدخال كود الأمان المكون من 6 أرقام كاملاً' : 'Please enter the complete 6-digit OTP code' });
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          code: cleanCode,
          purpose: otpPurpose,
          newPassword: otpPurpose === 'reset' ? (newPassword || password) : undefined
        })
      });
      const data = await res.json();

      if (data.success || data.verified) {
        setFeedback({
          type: 'success',
          text: isRtl ? 'تم التحقق من الكود وتأكيد الحساب بنجاح! 🔓' : 'Code verified and account activated successfully! 🔓'
        });

        const registeredList = getRegisteredUsers();
        let userToLog: User = data.user || {
          email: cleanEmail,
          name: fullname || cleanEmail.split('@')[0],
          role: cleanEmail === 'ryvo.shopa@gmail.com' ? 'admin' : 'customer',
          favorites: [],
          points: 100
        };

        const existingIdx = registeredList.findIndex(u => u.email.toLowerCase() === cleanEmail);
        if (existingIdx > -1) {
          registeredList[existingIdx] = { ...registeredList[existingIdx], ...userToLog };
        } else {
          registeredList.push(userToLog);
        }
        saveRegisteredUsers(registeredList);

        setTimeout(() => {
          onAuthSuccess(userToLog);
          onClose();
        }, 1000);
      } else {
        setFeedback({ type: 'error', text: data.error || (isRtl ? 'رمز التحقق المكون من 6 أرقام غير صحيح أو انتهت صلاحيته' : 'Invalid or expired OTP code') });
      }
    } catch (err) {
      setFeedback({ type: 'error', text: isRtl ? 'حدث خطأ في الاتصال بالخادم' : 'Server connection error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authMode === 'otp_verify') {
      return handleVerifyOtpSubmit(e);
    }

    setFeedback(null);
    const cleanEmail = email.toLowerCase().trim();

    if (authMode === 'forgot') {
      if (!cleanEmail) {
        setFeedback({ type: 'error', text: t.error_empty_fields });
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail })
        });
        const data = await res.json();
        if (data.success) {
          setOtpPurpose('reset');
          setAuthMode('otp_verify');
          setFeedback({
            type: 'success',
            text: isRtl 
              ? 'تم إرسال كود استعادة كلمة المرور المكون من 6 أرقام إلى بريدك الإلكتروني بنجاح! 📩' 
              : 'A 6-digit recovery code has been sent directly to your email inbox! 📩'
          });
          setIsLoading(false);
          return;
        } else {
          setFeedback({ type: 'error', text: data.error || (isRtl ? 'تعذر إرسال الكود' : 'Failed to send recovery code') });
        }
      } catch (err) {
        console.error("Forgot password API error:", err);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!cleanEmail || !password.trim() || (authMode === 'register' && !fullname.trim())) {
      setFeedback({ type: 'error', text: t.error_empty_fields });
      return;
    }

    const registeredList = getRegisteredUsers();

    // Check credentials via backend API + local fallback
    if (authMode === 'login') {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': cleanEmail,
            'x-admin-email': cleanEmail
          },
          body: JSON.stringify({ email: cleanEmail, password })
        });

        if (response.ok) {
          const resData = await response.json();
          let loggedUser: User = resData.user;

          // Absolute role override for super admin email
          if (cleanEmail === 'ryvo.shopa@gmail.com') {
            loggedUser.role = 'admin';
          }

          console.log("==========================================");
          console.log("🔑 [FRONTEND AUTH LOGIN SUCCESS DEBUG]:");
          console.log(" - user.id:", loggedUser.id || loggedUser.email);
          console.log(" - user.email:", loggedUser.email);
          console.log(" - user.role:", loggedUser.role);
          console.log(" - isAdmin:", loggedUser.role === 'admin');
          console.log(" - JWT Claims:", resData.jwtClaims || { sub: loggedUser.email, role: loggedUser.role, iat: Date.now() });
          console.log(" - Session Data:", resData.sessionData || { email: loggedUser.email, role: loggedUser.role, loginTime: new Date().toISOString() });
          console.log("==========================================");

          // Update registered list in localStorage to fix stale customer role
          const existingList = getRegisteredUsers();
          const userIndex = existingList.findIndex(u => u.email.toLowerCase() === cleanEmail);
          if (userIndex > -1) {
            existingList[userIndex] = { ...existingList[userIndex], ...loggedUser, role: loggedUser.role };
          } else {
            existingList.push({ ...loggedUser, password: password || '123456' });
          }
          saveRegisteredUsers(existingList);

          setFeedback({
            type: 'success',
            text: loggedUser.role === 'admin'
              ? t.auth_success_admin
              : loggedUser.role === 'affiliate'
                ? (currentLanguage === 'ar' ? 'تم تسجيل دخول الشريك المسوق بنجاح! 💸' : 'Affiliate partner logged in successfully! 💸')
                : t.auth_success_customer
          });

          setTimeout(() => {
            onAuthSuccess(loggedUser);
            onClose();
          }, 1000);
          return;
        } else {
          const resErr = await response.json().catch(() => ({}));
          const errMsg = resErr.error || (isRtl ? 'كلمة المرور أو البريد الإلكتروني غير صحيح' : 'Invalid email address or password');
          setFeedback({ type: 'error', text: errMsg });
          return;
        }
      } catch (apiErr) {
        console.warn("⚠️ API Login failed due to network error, attempting local fallback:", apiErr);
      }

      // Local Fallback Check (only when network/server is unreachable)
      let match = registeredList.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);

      // Force super admin role if logging in with primary email (strictly verify password)
      if (cleanEmail === 'ryvo.shopa@gmail.com') {
        const superPass = match?.password || '123456';
        if (password === superPass) {
          if (!match) {
            match = {
              email: 'ryvo.shopa@gmail.com',
              name: 'أدمن رايفو',
              role: 'admin',
              favorites: [],
              password: '123456'
            };
          } else {
            match.role = 'admin';
          }
        } else {
          match = undefined;
        }
      }

      // Extra fallback check to allow registered affiliates to log in directly
      if (!match) {
        try {
          const savedAff = localStorage.getItem('ryvo_affiliates');
          if (savedAff) {
            const parsed = JSON.parse(savedAff);
            const foundAff = parsed.find((a: any) => a.email.toLowerCase() === cleanEmail && a.password === password);
            if (foundAff) {
              match = {
                email: foundAff.email,
                name: foundAff.name,
                role: 'affiliate',
                favorites: [],
                password: foundAff.password,
                phone: foundAff.phone || ''
              };
              const updatedList = [...registeredList, match];
              saveRegisteredUsers(updatedList);
            }
          }
        } catch (_) {}
      }

      if (match) {
        if (cleanEmail === 'ryvo.shopa@gmail.com') {
          match.role = 'admin';
        }

        if (match.role === 'customer') {
          const award = 3;
          match.points = (match.points || 0) + award;
          if (!match.points_history) match.points_history = [];
          match.points_history.unshift({
            id: `pt-log-${Math.floor(Math.random() * 89999)}`,
            reason_ar: 'مكافأة نقاط تسجيل الدخول اليومي للمتجر 🪙',
            reason_en: 'Daily store loyalty login points reward 🪙',
            points: award,
            date: new Date().toISOString().split('T')[0]
          });
        }

        // Save back to list
        const newList = registeredList.map(u => u.email.toLowerCase() === match.email.toLowerCase() ? match : u);
        saveRegisteredUsers(newList);

        console.log("==========================================");
        console.log("🔑 [FRONTEND LOCAL FALLBACK LOGIN SUCCESS DEBUG]:");
        console.log(" - user.id:", match.id || match.email);
        console.log(" - user.email:", match.email);
        console.log(" - user.role:", match.role);
        console.log(" - isAdmin:", match.role === 'admin');
        console.log("==========================================");

        setFeedback({ 
          type: 'success', 
          text: match.role === 'admin' 
            ? t.auth_success_admin 
            : match.role === 'affiliate'
              ? (currentLanguage === 'ar' ? 'تم تسجيل دخول الشريك المسوق بنجاح! 💸' : 'Affiliate partner logged in successfully! 💸')
              : t.auth_success_customer 
        });
        setTimeout(() => {
          onAuthSuccess(match);
          onClose();
        }, 1000);
      } else {
        setFeedback({
          type: 'error',
          text: isRtl 
            ? 'يبدو أن البريد الإلكتروني أو كلمة المرور غير صحيحة! يرجى التحقق وإعادة المحاولة أو استعادتها.' 
            : 'Login failed. Invalid email address or password combination!'
        });
      }
    } else {
      // Sign-Up registration
      const dupe = registeredList.some(u => u.email.toLowerCase() === cleanEmail);
      if (dupe) {
        setFeedback({
          type: 'error',
          text: isRtl ? 'هذا البريد الإلكتروني مسجل بالفعل لمستخدم أخر!' : 'Email already linked to another active account!'
        });
        return;
      }

      setIsLoading(true);
      const roleType = cleanEmail === 'ryvo.shopa@gmail.com' ? 'admin' : 'customer';
      let newRegisteredUser: User = {
        email: cleanEmail,
        name: fullname,
        role: roleType,
        favorites: [],
        password: password,
        token: `token-user-${Math.floor(Math.random() * 8999)}`,
        points: roleType === 'customer' ? 100 : 0,
        points_history: roleType === 'customer' ? [
          {
            id: `pt-wel-${Math.floor(Math.random() * 89999)}`,
            reason_ar: 'الهدية الترحيبية لتسجيل حساب جديد بمتجر رايفو 🎉',
            reason_en: 'Welcome bonus gift for registering our new Ryvo account 🎉',
            points: 100,
            date: new Date().toISOString().split('T')[0]
          }
        ] : []
      };

      try {
        const regRes = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, name: fullname, password })
        });
        const regData = await regRes.json();
        if (regData.error && regData.error.toLowerCase().includes('already registered')) {
          setFeedback({
            type: 'error',
            text: isRtl ? 'هذا البريد الإلكتروني مسجل بالفعل لمستخدم آخر!' : 'Email already linked to another active account!'
          });
          setIsLoading(false);
          return;
        }

        // Move to OTP verification
        setOtpPurpose('verification');
        setAuthMode('otp_verify');
        setFeedback({
          type: 'success',
          text: isRtl
            ? 'تم إرسال كود التفعيل المكون من 6 أرقام إلى بريدك الإلكتروني بنجاح! 📩 أدخل الكود لإكمال التسجيل:'
            : 'A 6-digit OTP verification code was sent to your email inbox! 📩 Enter the code to activate your account:'
        });

        const newList = [...registeredList, newRegisteredUser];
        saveRegisteredUsers(newList);
      } catch (err) {
        console.error("Backend register API error:", err);
        setOtpPurpose('verification');
        setAuthMode('otp_verify');
        setFeedback({
          type: 'success',
          text: isRtl ? 'تم إنشاء الحساب، يرجى إدخال رمز التأكيد المرسل لبريدك' : 'Account created, please enter your OTP code'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4">
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 bg-slate-950/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"></div>

      {/* Dialog container */}
      <div id="auth-form-dialog" className="relative bg-white dark:bg-[#11141D] rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 sm:p-8 border border-slate-150 dark:border-[#1E293B] animate-in fade-in zoom-in-95 duration-200 text-slate-800 dark:text-gray-100">
        
        {/* Close button */}
        <button
          id="btn-auth-close"
          onClick={onClose}
          className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} p-2 rounded-full bg-slate-50 hover:bg-[var(--primary-color)] hover:text-slate-950 dark:bg-slate-900 dark:hover:bg-[var(--primary-color)] dark:hover:text-[#0A0C10] transition-all cursor-pointer`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="space-y-2 text-center pb-4">
          <h2 className="text-xl font-black tracking-tight text-slate-950 dark:text-white">
            {authMode === 'login' 
              ? t.login 
              : authMode === 'register' 
                ? t.register 
                : authMode === 'otp_verify'
                  ? (isRtl ? 'تأكيد كود الأمان 🔐' : 'Enter 6-Digit OTP 🔐')
                  : (isRtl ? 'استعادة كلمة المرور' : 'Recover Password')}
          </h2>
          <p className="text-xs text-slate-400 max-w-[280px] mx-auto leading-relaxed">
            {authMode === 'forgot' 
              ? (isRtl ? 'أدخل بريدك الإلكتروني وسنرسل لك كود التوثيق فوراً' : 'Enter your registered email and we will send a 6-digit code')
              : authMode === 'otp_verify'
                ? (isRtl ? `أدخل الرمز المكون من 6 أرقام المرسل إلى ${email}` : `Enter the 6-digit code sent to ${email}`)
                : t.welcome_text}
          </p>
        </div>

        {/* Alert Feedback messaging */}
        {feedback && (
          <div className={`p-4 rounded-xl text-xs font-bold ${
            feedback.type === 'error' 
              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' 
              : 'bg-[var(--primary-color, #dc2626)]/10 text-[var(--primary-color, #dc2626)] border border-[var(--primary-color, #dc2626)]/20'
          } mb-4 text-center`}>
            {feedback.type === 'success' && <UserCheck className="w-4 h-4 inline-block align-middle me-1" />}
            <span>{feedback.text}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* OTP Mode 6-Digit Code Input */}
          {authMode === 'otp_verify' ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block text-center">
                  {isRtl ? 'رمز التأكيد المكون من 6 أرقام' : '6-Digit Verification OTP'}
                </label>
                <input
                  id="auth-otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center text-2xl font-mono tracking-[0.5em] py-3.5 px-4 rounded-xl border bg-slate-50 dark:bg-[#0A0C10] border-slate-300 dark:border-slate-700 focus:border-red-500 focus:bg-white dark:focus:bg-black text-slate-850 dark:text-white outline-none transition-all"
                />
              </div>

              {otpPurpose === 'reset' && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">
                    {isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-sm py-2.5 px-3.5 rounded-xl border bg-slate-50 dark:bg-[#0A0C10] border-slate-300 dark:border-slate-700 focus:border-red-500 text-slate-850 dark:text-white outline-none"
                  />
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Full Name for register */}
              {authMode === 'register' && (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">{t.fullname_label}</label>
                  <input
                    id="auth-reg-fullname"
                    type="text"
                    required
                    value={fullname}
                    onChange={(e) => setFullname(e.target.value)}
                    className={`w-full text-base md:text-xs px-3.5 py-3 rounded-xl border bg-slate-50 dark:bg-[#0A0C10] border-transparent focus:border-[var(--primary-color, #38bdf8)] focus:bg-white dark:focus:bg-black text-slate-800 dark:text-white outline-none transition-all ${
                      isRtl ? 'text-right' : 'text-left'
                    }`}
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">{t.email_label}</label>
                <div className="relative">
                  <div className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center pointer-events-none text-slate-400`}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full text-base md:text-xs py-3 px-3.5 pr-10 rounded-xl border bg-slate-50 dark:bg-[#0A0C10] border-transparent focus:border-[var(--primary-color, #38bdf8)] focus:bg-white dark:focus:bg-black text-slate-850 dark:text-white outline-none transition-all ${
                      isRtl ? 'text-right pr-3.5 pl-10' : 'text-left pr-10 pl-3.5'
                    }`}
                  />
                </div>
              </div>

              {/* Password */}
              {authMode !== 'forgot' && (
                <div className="space-y-1 font-sans">
                  <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">{t.password_label}</label>
                  <div className="relative font-sans">
                    <div className={`absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center pointer-events-none text-slate-400`}>
                      <Key className="w-4 h-4" />
                    </div>
                    <input
                      id="auth-password-input"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full text-base md:text-xs py-3 px-10 rounded-xl border bg-slate-50 dark:bg-[#0A0C10] border-transparent focus:border-[var(--primary-color, #38bdf8)] focus:bg-white dark:focus:bg-black text-slate-850 dark:text-white outline-none transition-all placeholder-slate-400 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute inset-y-0 ${isRtl ? 'right-3' : 'left-3'} flex items-center text-slate-400 hover:text-[var(--primary-color)] transition-colors`}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Action button */}
          <button
            id="btn-auth-submit"
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition-all cursor-pointer text-xs uppercase shadow-lg shadow-red-600/30 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span className="inline-block animate-pulse">{isRtl ? 'جاري المعالجة...' : 'Processing...'}</span>
            ) : (
              authMode === 'login' 
                ? t.login 
                : authMode === 'register' 
                  ? t.register 
                  : authMode === 'otp_verify'
                    ? (isRtl ? 'تأكيد الكود وتأكيد الحساب 🔓' : 'Verify Code & Continue 🔓')
                    : (isRtl ? 'إرسال كود الأمان 📩' : 'Send Recovery OTP 📩')
            )}
          </button>
        </form>

        {/* Change auth mode */}
        <div className="flex flex-col gap-2 items-center justify-center pt-5 border-t border-slate-100 dark:border-slate-200 mt-5">
          {authMode === 'login' && (
            <button
              id="btn-auth-forgot-trigger"
              onClick={() => { setFeedback(null); setAuthMode('forgot'); }}
              className="text-[10px] font-bold uppercase text-amber-500 hover:underline cursor-pointer"
            >
              {isRtl ? 'هل نسيت كلمة المرور؟ 🔑' : 'Forgot Password? 🔑'}
            </button>
          )}

          <button
            id="btn-auth-mode-swap"
            onClick={() => {
              setFeedback(null);
              if (authMode === 'forgot') {
                setAuthMode('login');
              } else {
                setAuthMode(authMode === 'login' ? 'register' : 'login');
              }
            }}
            className="text-[10px] font-black uppercase text-[var(--primary-color, #38bdf8)] hover:underline cursor-pointer transition-colors"
          >
            {authMode === 'forgot'
              ? (isRtl ? 'العودة لتسجيل الدخول 🔙' : 'Back to Login 🔙')
              : authMode === 'login' ? t.dont_have_acc : t.already_have_acc}
          </button>
        </div>



      </div>
    </div>
  );
}
