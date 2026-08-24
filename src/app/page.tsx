'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { LoginForm } from '@/components/login-form';
import { MonitoringTable } from '@/components/monitoring/monitoring-table';
import { AuditLog } from '@/components/monitoring/audit-log';
import { DashboardCharts } from '@/components/dashboard/dashboard-charts';
import { AdminPanel } from '@/components/admin/admin-panel';
import { SettingsPanel } from '@/components/settings-panel';
import {
  Table2, History, BarChart3, Shield, LogOut, User, Settings, Eye,
} from 'lucide-react';

export default function HomePage() {
  const { user, setUser, activeTab, setActiveTab } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [setUser]);

  const handleLogout = async () => {
    await fetch('/api/auth', { method: 'DELETE' });
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen aero-bg flex items-center justify-center">
        <div className="glass-card rounded-2xl p-8 text-center">
          <div className="w-10 h-10 border-2 border-[#64b5f6]/30 border-t-[#64b5f6] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-[#78909c]">Memuat...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const isViewer = user.role === 'VIEWER';

  const tabs = [
    { id: 'monitoring' as const, label: 'Monitoring', icon: Table2 },
    { id: 'logs' as const, label: 'Audit Log', icon: History },
    { id: 'dashboard' as const, label: 'Dashboard', icon: BarChart3 },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
    ...(user.role === 'ADMIN' ? [{ id: 'admin' as const, label: 'Admin', icon: Shield }] : []),
  ];

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-[#ba68c8]/15 text-[#ce93d8] border border-[#ba68c8]/30';
      case 'VIEWER': return 'bg-[#81c784]/15 text-[#a5d6a7] border border-[#81c784]/30';
      default: return 'bg-[#64b5f6]/15 text-[#90caf9] border border-[#64b5f6]/30';
    }
  };

  return (
    <div className="min-h-screen aero-bg flex flex-col relative">
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Header Bar */}
        <header className="glass-nav sticky top-0 z-50 px-4 py-3">
          <div className="flex items-center justify-between max-w-[1920px] mx-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#64b5f6]/30 to-[#42a5f5]/10 border border-[#64b5f6]/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-[#64b5f6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                </svg>
              </div>
              <div>
                <h1 className="text-sm font-bold text-white leading-tight">TSA Outliers Monitoring</h1>
                <p className="text-[10px] text-[#546e7a]">138 Data Outlier &middot; 4 Provinsi</p>
              </div>
            </div>

            {/* Tab Navigation */}
            <nav className="flex items-center gap-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#64b5f6]/15 text-[#90caf9] border border-[#64b5f6]/20'
                        : 'text-[#78909c] hover:text-[#b0bec5] hover:bg-white/5'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* User Info */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.divisionName && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border" style={{
                    borderColor: '#64b5f650', color: '#90caf9', backgroundColor: '#64b5f615',
                  }}>{user.divisionName}</span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${getRoleBadgeStyle(user.role)}`}>
                  {user.role}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#64b5f6]/30 to-[#42a5f5]/10 border border-[#64b5f6]/20 flex items-center justify-center">
                    {isViewer ? <Eye className="w-3.5 h-3.5 text-[#81c784]" /> : <User className="w-3.5 h-3.5 text-[#64b5f6]" />}
                  </div>
                  <span className="text-xs text-[#b0bec5] hidden md:inline">{user.name}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-white/5 text-[#546e7a] hover:text-[#ef5350] transition-colors"
                title="Keluar"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 max-w-[1920px] mx-auto w-full" style={{ minHeight: 'calc(100vh - 60px)' }}>
          {activeTab === 'monitoring' && <MonitoringTable viewer={isViewer} />}
          {activeTab === 'logs' && <AuditLog />}
          {activeTab === 'dashboard' && <DashboardCharts />}
          {activeTab === 'settings' && <SettingsPanel />}
          {activeTab === 'admin' && <AdminPanel />}
        </main>

        {/* Footer */}
        <footer className="glass-nav mt-auto px-4 py-2 flex items-center justify-between">
          <p className="text-[10px] text-[#37474f]">TSA Outliers Monitoring System v2.0</p>
          <p className="text-[10px] text-[#37474f]">Data per 11 Agustus 2026</p>
        </footer>
      </div>
    </div>
  );
}
