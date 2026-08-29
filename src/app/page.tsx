'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { LoginForm } from '@/components/login-form';
import { MonitoringTable } from '@/components/monitoring/monitoring-table';
import { AuditLog } from '@/components/monitoring/audit-log';
import { AdminPanel } from '@/components/admin/admin-panel';
import { SettingsPanel } from '@/components/settings-panel';
import PivotCharts from '@/components/pivot/pivot-charts';
import { ProjectSwitcher } from '@/components/project-switcher';
import {
  Table2, History, Shield, LogOut, User, Settings, Eye, LayoutGrid,
} from 'lucide-react';

export default function HomePage() {
  const { user, setUser, activeTab, setActiveTab, activeProjectId, projects } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleProjectSwitched = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  useEffect(() => {
    window.addEventListener('project-switched', handleProjectSwitched);
    return () => window.removeEventListener('project-switched', handleProjectSwitched);
  }, [handleProjectSwitched]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Not authenticated');
      })
      .then(async data => {
        setUser(data.user);
        // Auto-setup Project table after login (creates table if missing)
        try { await fetch('/api/projects/setup', { method: 'POST' }); } catch {}
      })
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

  // Safety: if activeTab is 'dashboard' (removed), redirect to monitoring
  useEffect(() => {
    if ((activeTab as string) === 'dashboard') setActiveTab('monitoring');
  }, [activeTab, setActiveTab]);

  const isViewer = user.role === 'VIEWER';
  const activeProject = projects.find(p => p.id === activeProjectId);

  const tabs = [
    { id: 'monitoring' as const, label: 'Monitoring', icon: Table2 },
    { id: 'logs' as const, label: 'Audit Log', icon: History },
    { id: 'pivot' as const, label: 'Pivot', icon: LayoutGrid },
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
                <p className="text-[10px] text-[#546e7a]">
                  {activeProject?._count
                    ? `${activeProject._count.rows} Data ${activeProject.name}`
                    : activeProject?.name || 'Loading...'}
                </p>
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

            {/* Right: Project Switcher + User Info */}
            <div className="flex items-center gap-3">
              <ProjectSwitcher />
              <div className="w-px h-6 bg-white/[0.06]" />
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
          {activeTab === 'monitoring' && <MonitoringTable key={refreshKey} viewer={isViewer} />}
          {activeTab === 'logs' && <AuditLog key={refreshKey} />}
          {activeTab === 'pivot' && <PivotCharts key={refreshKey} />}
          {activeTab === 'settings' && <SettingsPanel key={refreshKey} />}
          {activeTab === 'admin' && <AdminPanel key={refreshKey} />}
        </main>

        {/* Footer */}
        <footer className="glass-nav mt-auto px-4 py-2 flex items-center justify-between">
          <p className="text-[10px] text-[#37474f]">TSA Outliers Monitoring System v2.0</p>
          <p className="text-[10px] text-[#37474f]">Multi-Project Enabled</p>
        </footer>
      </div>
    </div>
  );
}
