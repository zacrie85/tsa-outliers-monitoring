'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Shield, Edit2, Eye } from 'lucide-react';

const LOGIN_CARDS = [
  {
    role: 'ADMIN',
    label: 'Login sebagai Admin',
    icon: Shield,
    description: 'Akses penuh: kelola data, kolom, pengguna, dan pengaturan sistem',
    color: '#ba68c8',
    bgColor: 'rgba(186, 104, 200, 0.08)',
    borderColor: 'rgba(186, 104, 200, 0.2)',
    hoverBg: 'rgba(186, 104, 200, 0.15)',
  },
  {
    role: 'EDITOR',
    label: 'Login sebagai Editor',
    icon: Edit2,
    description: 'Edit data pada kolom yang diizinkan sesuai divisi masing-masing',
    color: '#64b5f6',
    bgColor: 'rgba(100, 181, 246, 0.08)',
    borderColor: 'rgba(100, 181, 246, 0.2)',
    hoverBg: 'rgba(100, 181, 246, 0.15)',
  },
  {
    role: 'VIEWER',
    label: 'Login sebagai Viewer',
    icon: Eye,
    description: 'Hanya melihat data dan dashboard tanpa bisa mengedit apapun',
    color: '#81c784',
    bgColor: 'rgba(129, 199, 132, 0.08)',
    borderColor: 'rgba(129, 199, 132, 0.2)',
    hoverBg: 'rgba(129, 199, 132, 0.15)',
  },
];

export function LoginForm() {
  const setUser = useAppStore((s) => s.setUser);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (role: string) => {
    if (!activeRole) {
      setActiveRole(role);
      return;
    }
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
      <div className="w-full max-w-4xl">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#64b5f6]/30 to-[#42a5f5]/10 border border-[#64b5f6]/20 win7-glow mb-4">
            <svg className="w-8 h-8 text-[#64b5f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">TSA Outliers Monitoring</h1>
          <p className="text-[#90a4ae] text-sm">Sistem Monitoring & Tracking Outliers TSA</p>
        </div>

        {/* 3 Login Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {LOGIN_CARDS.map((card) => {
            const Icon = card.icon;
            const isActive = activeRole === card.role;
            return (
              <button
                key={card.role}
                onClick={() => handleLogin(card.role)}
                disabled={loading}
                className="text-left rounded-2xl p-5 transition-all duration-200 border"
                style={{
                  backgroundColor: isActive ? card.hoverBg : card.bgColor,
                  borderColor: isActive ? card.color + '50' : card.borderColor,
                  boxShadow: isActive ? `0 0 20px ${card.color}15` : 'none',
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: card.color + '20' }}>
                    <Icon className="w-5 h-5" style={{ color: card.color }} />
                  </div>
                  <h3 className="text-sm font-semibold text-white">{card.label}</h3>
                </div>
                <p className="text-[11px] leading-relaxed text-[#90a4ae]">{card.description}</p>
              </button>
            );
          })}
        </div>

        {/* Login Form (appears when a role card is clicked) */}
        {activeRole && (
          <div className="glass-card rounded-2xl p-6 win7-glow">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-[#e3f2fd]">
                Masuk sebagai{' '}
                <span style={{ color: LOGIN_CARDS.find(c => c.role === activeRole)?.color }}>
                  {activeRole}
                </span>
              </h3>
              <button
                onClick={() => { setActiveRole(null); setError(''); }}
                className="text-xs text-[#546e7a] hover:text-white glass-btn rounded-lg px-3 py-1.5"
              >
                Kembali
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="flex-1 px-4 py-3 glass-input rounded-xl text-sm"
                placeholder="Username"
                autoFocus
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 px-4 py-3 glass-input rounded-xl text-sm"
                placeholder="Password"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(activeRole)}
              />
              <button
                onClick={() => handleLogin(activeRole)}
                disabled={loading || !username || !password}
                className="px-8 py-3 glass-btn rounded-xl font-semibold text-sm disabled:opacity-40 whitespace-nowrap"
              >
                {loading ? 'Memproses...' : 'Masuk'}
              </button>
            </div>
            {error && (
              <div className="mt-3 p-3 rounded-xl bg-[#ef5350]/10 border border-[#ef5350]/20 text-[#ef9a9a] text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
