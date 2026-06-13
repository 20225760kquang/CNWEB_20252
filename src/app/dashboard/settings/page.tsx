"use client";

import React, { useState } from "react";
import Button from "@/components/ui/Button";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);



  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: t('settings.pwdMismatch') });
      return;
    }
    
    setIsLoading(true);
    try {
      const res = await api.post<{message: string}>('/api/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      setMessage({ type: 'success', text: t('settings.successMsg') });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMessage({ type: 'error', text: err.detail || t('settings.errorMsg') });
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="max-w-3xl space-y-8 animate-in fade-in duration-300">
      
      {/* Language Settings */}
      <section className="bg-surface rounded-2xl p-6 shadow-ambient">
        <h2 className="text-xl font-semibold text-on-surface mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">language</span>
          {t('settings.languageSettings')}
        </h2>
        
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">{t('settings.systemLanguage')}</label>
            <div className="relative">
              <select 
                value={language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
                className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent cursor-pointer"
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English (US)</option>
              </select>
              <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant pointer-events-none">
                expand_more
              </span>
            </div>
            <p className="mt-2 text-xs text-on-surface-variant">{t('settings.languageDesc')}</p>
          </div>
        </div>
      </section>

      {/* Password Settings */}
      <section className="bg-surface rounded-2xl p-6 shadow-ambient">
        <h2 className="text-xl font-semibold text-on-surface mb-6 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">lock</span>
          {t('settings.securitySettings')}
        </h2>

        <form onSubmit={handlePasswordSubmit} className="space-y-5 max-w-md">
          {message && (
            <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {message.text}
            </div>
          )}
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">{t('settings.currentPassword')}</label>
            <input 
              type="password" 
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">{t('settings.newPassword')}</label>
            <input 
              type="password" 
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-on-surface mb-2">{t('settings.confirmPassword')}</label>
            <input 
              type="password" 
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/50 bg-surface text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" disabled={isLoading}>
              {isLoading ? t('settings.updatingBtn') : t('settings.updateBtn')}
            </Button>
          </div>
        </form>
      </section>
      
    </div>
  );
}
