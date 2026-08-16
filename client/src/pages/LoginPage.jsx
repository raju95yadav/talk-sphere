import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google';
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

  const handleGoogleSuccess = async (credentialResponse) => {
    if (!credentialResponse?.credential) {
      toast.error('Google Sign-In failed: No credential received');
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient.post('/api/auth/google', { token: credentialResponse.credential });
      toast.success('Login successful!');
      login(res.data.user, res.data.token, res.data.refreshToken);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Google Sign-In failed');
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
    <div className="dark min-h-screen relative flex items-center justify-center p-6 bg-[#121218] text-white overflow-hidden select-none">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ff0055]/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#702cf9]/20 rounded-full blur-[120px] animate-pulse delay-700"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg bg-[#1c1c24]/90 backdrop-blur-2xl p-8 md:p-12 shadow-2xl rounded-3xl relative z-10 border border-white/10"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <motion.div 
            whileHover={{ rotate: 10 }}
            className="w-20 h-20 bg-gradient-to-tr from-[#ff0055] to-[#702cf9] rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-[#ff0055]/20"
          >
            <ShieldCheck size={40} className="text-white" />
          </motion.div>
          <h2 className="text-4xl font-extrabold tracking-tighter mb-2 bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
            TALK SPHERE
          </h2>
          <p className="text-[#a0a0b8] font-medium text-sm md:text-base">
            Premium real-time communication platform
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 ? (
            <motion.form 
              key="email-step"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 30 }}
              onSubmit={handleRequestOtp}
              className="space-y-8"
            >
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-[#a0a0b8] uppercase tracking-[0.2em] ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a0a0b8] group-focus-within:text-[#ff0055] transition-colors">
                    <Mail size={20} />
                  </div>
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-[#252533] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-[#ff0055] focus:bg-[#1c1c24] outline-none transition-all placeholder:text-[#a0a0b8]/50 font-medium"
                    required
                  />
                </div>
              </div>

              <button 
                disabled={loading}
                className="w-full bg-[#ff0055] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-widest shadow-lg shadow-[#ff0055]/25 hover:bg-[#ff0055]/90 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>GET ONE-TIME PASSWORD <ArrowRight size={18} /></>}
              </button>

              <div className="flex items-center gap-4 my-6">
                <div className="h-px flex-1 bg-white/10"></div>
                <span className="text-[10px] font-bold text-[#a0a0b8] uppercase tracking-widest">── OR ──</span>
                <div className="h-px flex-1 bg-white/10"></div>
              </div>

              <button 
                type="button"
                onClick={() => handleGoogleCustomLogin()}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#252533] text-white font-black text-xs uppercase tracking-widest hover:bg-[#2c2c3d] border border-white/10 transition-all shadow-xl shadow-black/20 active:scale-[0.99] cursor-pointer"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>SIGN IN WITH GOOGLE</span>
              </button>
              
              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] text-[#a0a0b8] text-center leading-relaxed font-semibold">
                  A SECURE ACCESS CODE WILL BE SENT TO YOUR EMAIL DESTINATION.
                </p>
              </div>
            </motion.form>
          ) : (
            <motion.form 
              key="otp-step"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              onSubmit={handleVerifyOtp}
              className="space-y-8"
            >
              <div className="space-y-3">
                <label className="block text-[10px] font-bold text-[#a0a0b8] uppercase tracking-[0.2em] ml-1">
                  Verification Code
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a0a0b8] group-focus-within:text-[#ff0055] transition-colors">
                    <ShieldCheck size={20} />
                  </div>
                  <input 
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    maxLength="6"
                    className="w-full bg-[#252533] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-[#ff0055] focus:bg-[#1c1c24] outline-none transition-all text-center tracking-[0.8em] font-black text-xl placeholder:text-[#a0a0b8]/50"
                    required
                  />
                </div>
              </div>

              <button 
                disabled={loading}
                className="w-full bg-[#ff0055] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-widest shadow-lg shadow-[#ff0055]/25 hover:bg-[#ff0055]/90 hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>AUTHENTICATE & ENTER <ArrowRight size={18} /></>}
              </button>

              <button 
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-[#a0a0b8] text-xs font-bold hover:text-white transition-colors uppercase tracking-widest cursor-pointer"
              >
                Change Email
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default LoginPage;
