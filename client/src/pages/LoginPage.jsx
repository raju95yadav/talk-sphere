import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ShieldCheck, ArrowRight, Loader2, Lock, Sparkles } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!email) return toast.error('Please enter your email');
    
    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/request-otp', { email });
      toast.success(res.data.message);
      setStep(2);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp) return toast.error('Please enter the OTP');

    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/verify-otp', { email, code: otp });
      toast.success('Login successful!');
      login(res.data.user, res.data.token, res.data.refreshToken);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    toast.error('Google Sign-In failed');
  };

  const handleGoogleCustomLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      if (!tokenResponse?.access_token) {
        toast.error('Google Sign-In failed: No token received');
        return;
      }
      setLoading(true);
      try {
        const res = await apiClient.post('/api/auth/google', { token: tokenResponse.access_token });
        toast.success('Login successful!');
        login(res.data.user, res.data.token, res.data.refreshToken);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Google Sign-In failed');
      } finally {
        setLoading(false);
      }
    },
    onError: handleGoogleError
  });

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#04060f] text-white overflow-hidden select-none">
      {/* Dynamic Animated Hero Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Animated Background Image hero-1.jpg */}
        <motion.img
          src="/hero-1.jpg"
          alt="Cyber Handshake Background"
          initial={{ scale: 1.02 }}
          animate={{
            scale: [1.02, 1.10, 1.02],
            x: [0, -15, 0],
            y: [0, 10, 0],
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'easeInOut',
          }}
          className="w-full h-full object-cover object-center opacity-85 filter brightness-105 contrast-110"
        />

        {/* Cyber Gradient and Vignette Overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#04060f]/80 via-[#050816]/35 to-[#04060f]/85" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_30%,_#04060f_92%)]" />

        {/* Ambient Glowing Orbs */}
        <motion.div
          animate={{
            x: [0, 30, 0],
            y: [0, -25, 0],
            opacity: [0.35, 0.6, 0.35],
          }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/5 left-1/5 w-72 sm:w-96 h-72 sm:h-96 bg-cyan-400/25 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{
            x: [0, -25, 0],
            y: [0, 25, 0],
            opacity: [0.25, 0.5, 0.25],
          }}
          transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
          className="absolute bottom-1/5 right-1/5 w-72 sm:w-96 h-72 sm:h-96 bg-[#ff0055]/20 rounded-full blur-[110px]"
        />
      </div>

      {/* Main Glassmorphic Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-[440px] relative z-10 rounded-3xl bg-[#0a0f20]/80 backdrop-blur-2xl p-6 sm:p-8 border border-white/15 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_40px_rgba(0,240,255,0.15)] overflow-hidden"
      >
        {/* Top Shimmer Gradient Accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] via-[#ff0055] to-transparent animate-pulse" />

        {/* Header Branding */}
        <div className="flex flex-col items-center mb-6 text-center">
          {/* Glowing Animated Shield Icon */}
          <motion.div
            whileHover={{ scale: 1.08, rotate: 6 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-16 h-16 rounded-2xl p-[1.5px] bg-gradient-to-tr from-[#00f0ff] via-[#ff0055] to-[#702cf9] mb-4 shadow-lg shadow-[#00f0ff]/25 cursor-pointer"
          >
            <div className="w-full h-full bg-[#080d1a] rounded-[14px] flex items-center justify-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#00f0ff]/20 via-transparent to-[#ff0055]/20 opacity-90" />
              <ShieldCheck size={32} className="text-white drop-shadow-[0_0_10px_rgba(0,240,255,0.9)] relative z-10" />
            </div>
          </motion.div>

          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 border border-cyan-400/25 text-cyan-300 mb-2.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Next-Gen Connection
          </div>

          <h1 className="text-3xl font-black tracking-tight mb-1 bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
            TALK SPHERE
          </h1>
          <p className="text-[#94a3b8] text-xs sm:text-[13px] max-w-xs font-medium">
            Premium real-time communication platform
          </p>
        </div>

        {/* Interactive Forms */}
        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form
              key="email-step"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleRequestOtp}
              className="space-y-4 sm:space-y-5"
            >
              <div className="space-y-2">
                <label className="flex items-center justify-between text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider ml-1">
                  <span>Work or Personal Email</span>
                  <span className="text-[10px] text-cyan-400/90 font-semibold normal-case tracking-normal">Fast OTP login</span>
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b] group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#111728]/90 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white text-sm focus:border-cyan-400/80 focus:bg-[#151d33] focus:ring-4 focus:ring-cyan-500/15 outline-none transition-all placeholder:text-[#64748b] font-medium shadow-inner"
                    required
                  />
                </div>
              </div>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                disabled={loading}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-[#ff0055] via-[#ff2266] to-[#702cf9] text-white font-extrabold py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-lg shadow-[#ff0055]/30 hover:shadow-[#ff0055]/50 transition-all cursor-pointer disabled:opacity-60"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <Loader2 className="animate-spin" size={17} />
                  ) : (
                    <>
                      GET ONE-TIME PASSWORD <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </motion.button>

              <div className="flex items-center gap-3 my-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-widest">or continue with</span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
              </div>

              <motion.button
                type="button"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                onClick={() => handleGoogleCustomLogin()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-2xl bg-[#12182b]/90 hover:bg-[#18213a] text-white font-bold text-xs uppercase tracking-wider border border-white/10 hover:border-white/20 transition-all shadow-md shadow-black/30 cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>SIGN IN WITH GOOGLE</span>
              </motion.button>

              <div className="pt-1 text-center">
                <p className="text-[10px] text-[#64748b] leading-relaxed flex items-center justify-center gap-1.5 font-medium">
                  <Lock size={11} className="text-cyan-400" />
                  A secure access code will be sent to your email.
                </p>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="otp-step"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleVerifyOtp}
              className="space-y-4 sm:space-y-5"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider ml-1">
                  <span>Verification Code</span>
                  <span className="text-[10px] text-cyan-400 font-semibold normal-case">Check your inbox</span>
                </div>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b] group-focus-within:text-cyan-400 transition-colors pointer-events-none">
                    <ShieldCheck size={19} />
                  </div>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    maxLength="6"
                    className="w-full bg-[#111728]/90 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-white focus:border-cyan-400/80 focus:bg-[#151d33] focus:ring-4 focus:ring-cyan-500/15 outline-none transition-all text-center tracking-[0.6em] sm:tracking-[0.8em] font-black text-xl placeholder:text-[#475569] shadow-inner"
                    required
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-[#64748b] text-center">
                  Sent to <span className="text-white font-medium">{email}</span>
                </p>
              </div>

              <motion.button
                type="submit"
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                disabled={loading}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-[#00d2ff] via-[#00f0ff] to-[#702cf9] text-[#050814] font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs uppercase tracking-widest shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all cursor-pointer disabled:opacity-60"
              >
                <span className="relative z-10 flex items-center gap-2">
                  {loading ? (
                    <Loader2 className="animate-spin text-black" size={17} />
                  ) : (
                    <>
                      AUTHENTICATE & ENTER <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-white/25 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </motion.button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-[#94a3b8] hover:text-white text-xs font-bold transition-colors uppercase tracking-widest cursor-pointer py-1.5"
              >
                ← Change Email Address
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default LoginPage;
