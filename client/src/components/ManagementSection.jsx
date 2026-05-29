import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Save, ShieldCheck, MapPin } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/apiClient';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

const ManagementSection = () => {
  const { user, token, refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    phoneNumber: user?.phoneNumber || '',
    age: user?.age || '',
    address: user?.address || '' // Added address as requested "gmail address" usually means physical but I'll add a field
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        phoneNumber: user.phoneNumber || '',
        age: user.age || '',
        address: user.address || ''
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiClient.put('/api/users/profile', formData);
      toast.success('Security Profile Updated');
      refreshUser();
    } catch (err) {
      toast.error('Sync Failure');
    } finally {
      setIsSaving(false);
    }
  };

  const inputClasses = "w-full bg-bg-card-secondary border border-border-main rounded-2xl py-4 px-6 text-sm font-bold text-text-main focus:border-accent-primary outline-none transition-all placeholder:text-text-muted/30";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="lg:col-span-8 glass-card p-10 overflow-hidden relative"
    >
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <ShieldCheck size={200} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 bg-accent-primary/20 rounded-2xl text-accent-primary">
            <User size={24} />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">IDENTITY MANAGEMENT</h3>
            <p className="text-[10px] text-text-muted font-bold uppercase tracking-[0.2em]">Update your global credentials</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-2">Legal Name</label>
              <div className="relative">
                <User className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`${inputClasses} pl-14`} 
                  placeholder="FULL NAME"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-2">Alias / Username</label>
              <div className="relative">
                <ShieldCheck className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input 
                  type="text" 
                  value={formData.username}
                  onChange={(e) => setFormData({...formData, username: e.target.value})}
                  className={`${inputClasses} pl-14`} 
                  placeholder="ALIAS"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-2">Secure Line (Phone)</label>
              <div className="relative">
                <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input 
                  type="text" 
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                  className={`${inputClasses} pl-14`} 
                  placeholder="PHONE NUMBER"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-2">Biological Age</label>
              <div className="relative">
                <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <input 
                  type="number" 
                  value={formData.age}
                  onChange={(e) => setFormData({...formData, age: e.target.value})}
                  className={`${inputClasses} pl-14`} 
                  placeholder="AGE"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-widest px-2">Physical Vector (Address)</label>
            <div className="relative">
              <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
              <input 
                type="text" 
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
                className={`${inputClasses} pl-14`} 
                placeholder="CURRENT LOCATION / ADDRESS"
              />
            </div>
          </div>

          <div className="pt-6">
            <button 
              type="submit" 
              disabled={isSaving}
              className="w-full md:w-auto flex items-center justify-center gap-3 bg-accent-primary text-white font-black py-4 px-10 rounded-2xl shadow-2xl shadow-accent-primary/30 hover:scale-105 active:scale-95 transition-all uppercase tracking-[0.2em] text-xs disabled:opacity-50"
            >
              {isSaving ? 'SYNCHRONIZING...' : <><Save size={18} /> COMMIT CHANGES</>}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
};

export default ManagementSection;
