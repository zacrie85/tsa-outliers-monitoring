'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lock, Check, X, Shield, Edit2, Eye, KeyRound } from 'lucide-react';

const SETTINGS_PASSWORD = 'asrama33';

export function SettingsPanel() {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [gatePassword, setGatePassword] = useState('');
  const [gateError, setGateError] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [changingPassword, setChangingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

// eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (isUnlocked) { void fetchUsers(); } }, [isUnlocked, fetchUsers]);

  const handleUnlock = () => {
    if (gatePassword === SETTINGS_PASSWORD) {
      setIsUnlocked(true);
      setGateError('');
    } else {
      setGateError('Password salah!');
    }
  };

  const handleChangePassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 4) {
      setSaveMsg({ type: 'error', text: 'Password minimal 4 karakter' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setSaveMsg({ type: 'error', text: 'Konfirmasi password tidak cocok' });
      return;
    }
    try {
      const res = await fetch('/api/users/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, newPassword }),
      });
      if (res.ok) {
        setSaveMsg({ type: 'success', text: 'Password berhasil diubah' });
        setChangingPassword(null);
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setSaveMsg(null), 3000);
      } else {
        const data = await res.json();
        setSaveMsg({ type: 'error', text: data.error || 'Gagal mengubah password' });
      }
    } catch {
      setSaveMsg({ type: 'error', text: 'Terjadi kesalahan' });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'ADMIN': return <Shield className="w-4 h-4" />;
      case 'VIEWER': return <Eye className="w-4 h-4" />;
      default: return <Edit2 className="w-4 h-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return '#ba68c8';
      case 'VIEWER': return '#81c784';
      default: return '#64b5f6';
    }
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="glass-card rounded-2xl p-8 max-w-sm w-full text-center win7-glow">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#ffb74d]/20 to-[#ff9800]/10 border border-[#ffb74d]/20 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-[#ffb74d]" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Pengaturan Sistem</h2>
          <p className="text-xs text-[#78909c] mb-5">Masukkan password untuk mengakses pengaturan</p>
          <div className="space-y-3">
            <input
              type="password"
              value={gatePassword}
              onChange={(e) => setGatePassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
              className="w-full px-4 py-3 glass-input rounded-xl text-sm text-center"
              placeholder="Password pengaturan"
              autoFocus
            />
            {gateError && (
              <p className="text-xs text-[#ef5350]">{gateError}</p>
            )}
            <button
              onClick={handleUnlock}
              className="w-full py-3 glass-btn rounded-xl font-semibold text-sm"
            >
              Buka Pengaturan
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto aero-scroll">
      {saveMsg && (
        <div className={`rounded-xl p-3 text-sm flex items-center gap-2 border ${
          saveMsg.type === 'success'
            ? 'bg-[#81c784]/10 border-[#81c784]/20 text-[#a5d6a7]'
            : 'bg-[#ef5350]/10 border-[#ef5350]/20 text-[#ef9a9a]'
        }`}>
          {saveMsg.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {saveMsg.text}
        </div>
      )}

      <div className="glass-card rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[#e3f2fd] mb-4">Kelola Password Pengguna</h3>
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 group hover:bg-white/8 transition-colors">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: getRoleColor(u.role) + '20', color: getRoleColor(u.role) }}>
                  {getRoleIcon(u.role)}
                </span>
                <div>
                  <p className="text-sm font-medium text-[#e0e0e0]">{u.name}</p>
                  <p className="text-[10px] text-[#546e7a]">@{u.username} {u.division ? `· ${u.division.name}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {changingPassword === u.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="px-2.5 py-1.5 glass-input rounded-lg text-xs w-32"
                      placeholder="Password baru"
                      autoFocus
                    />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleChangePassword(u.id)}
                      className="px-2.5 py-1.5 glass-input rounded-lg text-xs w-32"
                      placeholder="Konfirmasi"
                    />
                    <button onClick={() => handleChangePassword(u.id)} className="p-1.5 rounded-lg bg-[#81c784]/15 text-[#81c784] hover:bg-[#81c784]/25">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setChangingPassword(null); setNewPassword(''); setConfirmPassword(''); }} className="p-1.5 rounded-lg hover:bg-white/10 text-[#78909c]">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setChangingPassword(u.id)}
                    className="px-3 py-1.5 glass-btn rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Ubah Password
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
