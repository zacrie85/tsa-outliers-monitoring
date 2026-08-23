'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/app-store';

export function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useAppStore((s) => s.setUser);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Login gagal');
      }

      const data = await res.json();
      setUser(data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen aero-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#64b5f6]/30 to-[#42a5f5]/10 border border-[#64b5f6]/20 win7-glow mb-4">
            <svg className="w-8 h-8 text-[#64b5f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">TSA Outliers Monitoring</h1>
          <p className="text-[#90a4ae] text-sm">Sistem Monitoring & Tracking Outliers TSA</p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-2xl p-8 win7-glow">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#b0bec5] mb-2">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                placeholder="Masukkan username"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#b0bec5] mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 glass-input rounded-xl text-sm"
                placeholder="Masukkan password"
                required
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-[#ef5350]/10 border border-[#ef5350]/20 text-[#ef9a9a] text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 glass-btn rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/5">
            <p className="text-[11px] text-[#546e7a] text-center">Demo Credentials</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
              <div className="glass-card rounded-lg p-2.5 text-center">
                <p className="text-[#64b5f6] font-semibold">Admin</p>
                <p className="text-[#78909c]">admin / admin123</p>
              </div>
              <div className="glass-card rounded-lg p-2.5 text-center">
                <p className="text-[#81c784] font-semibold">Editor</p>
                <p className="text-[#78909c]">tsa_editor / password123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}