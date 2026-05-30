import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
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

  return (
    <div className="min-h-screen relative flex items-center justify-center p-6 bg-bg-main overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent-primary/20 rounded-full blur-[120px] animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent-secondary/20 rounded-full blur-[120px] animate-pulse delay-700"></div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg glass-card p-8 md:p-12 shadow-2xl relative z-10 border border-border-main"
      >
        <div className="flex flex-col items-center mb-10 text-center">
          <motion.div 
            whileHover={{ rotate: 10 }}
            className="w-20 h-20 bg-gradient-to-tr from-accent-primary to-accent-secondary rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-accent-primary/20"
          >
            <ShieldCheck size={40} className="text-white" />
          </motion.div>
          <h2 className="text-4xl font-extrabold tracking-tighter mb-2 bg-gradient-to-r dark:from-white dark:to-white/60 from-slate-900 to-slate-700 bg-clip-text text-transparent">
            TALK SPHERE
          </h2>
          <p className="text-text-muted font-medium text-sm md:text-base">
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
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] ml-1">
                  Email Address
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-primary transition-colors">
                    <Mail size={20} />
                  </div>
                  <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full bg-bg-card-secondary border border-border-main rounded-2xl py-4 pl-12 pr-4 text-text-main focus:border-accent-primary focus:bg-bg-card outline-none transition-all placeholder:text-text-muted/50"
                    required
                  />
                </div>
              </div>

              <button 
                disabled={loading}
                className="w-full btn-primary py-4 flex items-center justify-center gap-3 text-sm"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>GET ONE-TIME PASSWORD <ArrowRight size={18} /></>}
              </button>

              <div className="flex items-center gap-4 my-6">
                <div className="h-px flex-1 bg-black/10 dark:bg-white/10"></div>
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">OR CONTINUE WITH</span>
                <div className="h-px flex-1 bg-black/10 dark:bg-white/10"></div>
              </div>

              <button 
                type="button"
                onClick={() => toast.success('Google Login coming soon in production!')}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-widest hover:bg-white/90 border border-slate-200 dark:border-transparent transition-all shadow-xl dark:shadow-white/5 shadow-black/5"
              >
                <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="google" />
                SIGN IN WITH GOOGLE
              </button>
              
              <div className="pt-4 border-t border-black/5 dark:border-white/5">
                <p className="text-[10px] text-text-muted text-center leading-relaxed font-semibold">
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
                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] ml-1">
                  Verification Code
                </label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-primary transition-colors">
                    <ShieldCheck size={20} />
                  </div>
                  <input 
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    maxLength="6"
                    className="w-full bg-bg-card-secondary border border-border-main rounded-2xl py-4 pl-12 pr-4 text-text-main focus:border-accent-primary focus:bg-bg-card outline-none transition-all text-center tracking-[0.8em] font-black text-xl"
                    required
                  />
                </div>
              </div>

              <button 
                disabled={loading}
                className="w-full btn-primary py-4 flex items-center justify-center gap-3 text-sm"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <>AUTHENTICATE & ENTER <ArrowRight size={18} /></>}
              </button>

              <button 
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-text-muted text-xs font-bold hover:text-text-main transition-colors uppercase tracking-widest"
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
