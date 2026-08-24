'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Building2, Plus, Shield, Edit, Trash2, X, Check, Eye, TriangleAlert, Pencil, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/app-store';

export function AdminPanel() {
  const currentUser = useAppStore((s) => s.user);
  const [users, setUsers] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddDiv, setShowAddDiv] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', name: '', password: '', role: 'EDITOR', divisionId: '' });
  const [newDiv, setNewDiv] = useState({ name: '', color: '#6366f1' });
  const [editingDiv, setEditingDiv] = useState<string | null>(null);
  const [editDivName, setEditDivName] = useState('');
  const [editDivColor, setEditDivColor] = useState('#6366f1');
  const [deleteDivTarget, setDeleteDivTarget] = useState<any>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<any>(null);
  const [divActionLoading, setDivActionLoading] = useState(false);
  const [userActionLoading, setUserActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [usersRes, divRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/divisions'),
      ]);
      const usersData = await usersRes.json();
      const divData = await divRes.json();
      setUsers(usersData.users);
      setDivisions(divData.divisions);
    } catch (err) {
      console.error(err);
    }
  }, []);

// eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleAddUser = async () => {
    if (!newUser.username || !newUser.name || !newUser.password) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      });
      if (res.ok) {
        setNewUser({ username: '', name: '', password: '', role: 'EDITOR', divisionId: '' });
        setShowAddUser(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddDiv = async () => {
    if (!newDiv.name.trim()) return;
    try {
      const res = await fetch('/api/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDiv),
      });
      const data = await res.json();
      if (res.ok) {
        setNewDiv({ name: '', color: '#6366f1' });
        setShowAddDiv(false);
        fetchData();
      } else {
        alert(data.error || 'Gagal menambah divisi');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditDiv = (div: any) => {
    setEditingDiv(div.id);
    setEditDivName(div.name);
    setEditDivColor(div.color);
  };

  const cancelEditDiv = () => {
    setEditingDiv(null);
    setEditDivName('');
    setEditDivColor('#6366f1');
  };

  const handleSaveEditDiv = async (divId: string) => {
    if (!editDivName.trim()) return;
    setDivActionLoading(true);
    try {
      const res = await fetch('/api/divisions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: divId, name: editDivName, color: editDivColor }),
      });
      const data = await res.json();
      if (res.ok) {
        cancelEditDiv();
        fetchData();
      } else {
        alert(data.error || 'Gagal mengubah divisi');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDivActionLoading(false);
    }
  };

  const handleDeleteDiv = async () => {
    if (!deleteDivTarget) return;
    setDivActionLoading(true);
    try {
      const res = await fetch(`/api/divisions?id=${deleteDivTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setDeleteDivTarget(null);
        fetchData();
      } else {
        alert(data.error || 'Gagal menghapus divisi');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDivActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setUserActionLoading(true);
    try {
      const res = await fetch(`/api/users?id=${deleteUserTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setDeleteUserTarget(null);
        fetchData();
      } else {
        alert(data.error || 'Gagal menghapus pengguna');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUserActionLoading(false);
    }
  };

  const colorPalette = [
    '#ef5350', '#ff7043', '#ffa726', '#ffca28', '#66bb6a',
    '#26a69a', '#42a5f5', '#5c6bc0', '#ab47bc', '#ec407a',
    '#8d6e63', '#78909c', '#6366f1', '#00bcd4', '#cddc39',
  ];

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto aero-scroll">
      {/* Delete User Confirmation Dialog */}
      {deleteUserTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-xl p-5 max-w-sm mx-4" style={{ background: 'rgba(13, 27, 42, 0.97)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#ef5350]/20 flex items-center justify-center">
                <TriangleAlert className="w-4 h-4 text-[#ef5350]" />
              </div>
              <h3 className="text-sm font-semibold text-[#e3f2fd]">Hapus Pengguna?</h3>
            </div>
            <div className="p-3 rounded-lg bg-[#ef5350]/10 border border-[#ef5350]/20 mb-4">
              <p className="text-xs text-[#ef9a9a]">
                Pengguna <strong>&quot;{deleteUserTarget.name}&quot;</strong> (@{deleteUserTarget.username})
                dengan role <strong>{deleteUserTarget.role}</strong> akan dihapus secara permanen.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteUserTarget(null)} disabled={userActionLoading}
                className="px-4 py-2 glass-btn rounded-lg text-sm">Batal</button>
              <button onClick={handleDeleteUser} disabled={userActionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                style={{background:'linear-gradient(135deg, rgba(239,83,80,0.3), rgba(229,57,53,0.3))', border:'1px solid rgba(239,83,80,0.4)', color:'#ef5350'}}>
                {userActionLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghapus...</> : <><Trash2 className="w-3.5 h-3.5" /> Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Division Confirmation Dialog */}
      {deleteDivTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card rounded-xl p-5 max-w-sm mx-4" style={{ background: 'rgba(13, 27, 42, 0.97)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#ef5350]/20 flex items-center justify-center">
                <TriangleAlert className="w-4 h-4 text-[#ef5350]" />
              </div>
              <h3 className="text-sm font-semibold text-[#e3f2fd]">Hapus Divisi?</h3>
            </div>
            <div className="p-3 rounded-lg bg-[#ef5350]/10 border border-[#ef5350]/20 mb-4">
              <p className="text-xs text-[#ef9a9a]">
                Divisi <strong>&quot;{deleteDivTarget.name}&quot;</strong> akan dihapus.
              </p>
              {(deleteDivTarget._count.users > 0 || deleteDivTarget._count.columns > 0) && (
                <p className="text-[11px] text-[#ffab91] mt-2">
                  {deleteDivTarget._count.users > 0 && `${deleteDivTarget._count.users} pengguna `}
                  {deleteDivTarget._count.users > 0 && deleteDivTarget._count.columns > 0 && 'dan '}
                  {deleteDivTarget._count.columns > 0 && `${deleteDivTarget._count.columns} kolom kustom `}
                  akan dilepaskan dari divisi ini.
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteDivTarget(null)} disabled={divActionLoading}
                className="px-4 py-2 glass-btn rounded-lg text-sm">Batal</button>
              <button onClick={handleDeleteDiv} disabled={divActionLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40"
                style={{background:'linear-gradient(135deg, rgba(239,83,80,0.3), rgba(229,57,53,0.3))', border:'1px solid rgba(239,83,80,0.4)', color:'#ef5350'}}>
                {divActionLoading ? 'Menghapus...' : <><Trash2 className="w-3.5 h-3.5" /> Hapus</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Divisions Section */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#ffb74d]" />
            <h3 className="text-sm font-semibold text-[#e3f2fd]">Manajemen Divisi</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#ffb74d]/15 text-[#ffb74d] border border-[#ffb74d]/30">
              {divisions.length} divisi
            </span>
          </div>
          <button onClick={() => setShowAddDiv(!showAddDiv)} className="flex items-center gap-1 px-3 py-1.5 glass-btn rounded-lg text-xs">
            <Plus className="w-3.5 h-3.5" /> Tambah Divisi
          </button>
        </div>

        {showAddDiv && (
          <div className="p-4 rounded-xl bg-white/5 mb-4 border border-white/5">
            <p className="text-[10px] text-[#78909c] mb-2 font-medium">Divisi Baru</p>
            <div className="flex items-center gap-3 mb-3">
              <input value={newDiv.name} onChange={(e) => setNewDiv(p => ({ ...p, name: e.target.value }))}
                className="flex-1 px-3 py-2 glass-input rounded-lg text-sm" placeholder="Nama divisi (contoh: Editor 1, AMT, dll)" />
              <input type="color" value={newDiv.color} onChange={(e) => setNewDiv(p => ({ ...p, color: e.target.value }))}
                className="w-10 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-[10px] text-[#546e7a] leading-6">Pilih warna:</span>
              {colorPalette.map(c => (
                <button key={c} onClick={() => setNewDiv(p => ({ ...p, color: c }))}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${newDiv.color === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowAddDiv(false); setNewDiv({ name: '', color: '#6366f1' }); }}
                className="px-3 py-1.5 glass-btn rounded-lg text-xs">Batal</button>
              <button onClick={handleAddDiv} className="px-4 py-1.5 glass-btn-success rounded-lg text-xs">Simpan</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {divisions.map(div => (
            <div key={div.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors group">
              {editingDiv === div.id ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <input type="color" value={editDivColor} onChange={(e) => setEditDivColor(e.target.value)}
                      className="w-8 h-8 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
                    <input value={editDivName} onChange={(e) => setEditDivName(e.target.value)}
                      className="flex-1 px-3 py-1.5 glass-input rounded-lg text-sm" placeholder="Nama divisi" />
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {colorPalette.map(c => (
                      <button key={c} onClick={() => setEditDivColor(c)}
                        className={`w-5 h-5 rounded-full border-2 transition-all ${editDivColor === c ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button onClick={cancelEditDiv} className="px-3 py-1 glass-btn rounded-lg text-[11px]">Batal</button>
                    <button onClick={() => handleSaveEditDiv(div.id)} disabled={divActionLoading || !editDivName.trim()}
                      className="flex items-center gap-1 px-3 py-1 glass-btn-success rounded-lg text-[11px] disabled:opacity-40">
                      <Check className="w-3 h-3" /> Simpan
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: div.color }} />
                    <div>
                      <p className="text-sm font-medium">{div.name}</p>
                      <p className="text-[11px] text-[#546e7a]">
                        {div._count.users} pengguna
                        {div._count.columns > 0 && <> &middot; {div._count.columns} kolom</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => startEditDiv(div)}
                      className="p-1.5 rounded-md hover:bg-white/10 text-[#78909c] hover:text-[#64b5f6] transition-colors"
                      title="Edit divisi">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteDivTarget(div)}
                      className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#78909c] hover:text-[#ef5350] transition-colors"
                      title="Hapus divisi">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {divisions.length === 0 && !showAddDiv && (
          <div className="text-center py-8">
            <Building2 className="w-8 h-8 text-[#37474f] mx-auto mb-2" />
            <p className="text-sm text-[#546e7a]">Belum ada divisi</p>
            <p className="text-[11px] text-[#37474f] mt-1">Tambahkan divisi untuk mengelola akses pengguna</p>
          </div>
        )}
      </div>

      {/* Users Section */}
      <div className="glass-card rounded-xl p-5 flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#64b5f6]" />
            <h3 className="text-sm font-semibold text-[#e3f2fd]">Manajemen Pengguna</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#64b5f6]/15 text-[#64b5f6] border border-[#64b5f6]/30">
              {users.length} pengguna
            </span>
          </div>
          <button onClick={() => setShowAddUser(!showAddUser)} className="flex items-center gap-1 px-3 py-1.5 glass-btn rounded-lg text-xs">
            <Plus className="w-3.5 h-3.5" /> Tambah Pengguna
          </button>
        </div>

        {showAddUser && (
          <div className="p-4 rounded-xl bg-white/5 mb-4">
            <p className="text-[10px] text-[#78909c] mb-3 font-medium">Pengguna Baru</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[10px] text-[#546e7a] mb-1">Username</label>
                <input value={newUser.username} onChange={(e) => setNewUser(p => ({ ...p, username: e.target.value }))}
                  className="w-full px-3 py-2 glass-input rounded-lg text-sm" placeholder="Username" />
              </div>
              <div>
                <label className="block text-[10px] text-[#546e7a] mb-1">Nama</label>
                <input value={newUser.name} onChange={(e) => setNewUser(p => ({ ...p, name: e.target.value }))}
                  className="w-full px-3 py-2 glass-input rounded-lg text-sm" placeholder="Nama lengkap" />
              </div>
              <div>
                <label className="block text-[10px] text-[#546e7a] mb-1">Password</label>
                <input type="password" value={newUser.password} onChange={(e) => setNewUser(p => ({ ...p, password: e.target.value }))}
                  className="w-full px-3 py-2 glass-input rounded-lg text-sm" placeholder="Password" />
              </div>
              <div>
                <label className="block text-[10px] text-[#546e7a] mb-1">Role</label>
                <select value={newUser.role} onChange={(e) => setNewUser(p => ({ ...p, role: e.target.value }))}
                  className="w-full px-3 py-2 glass-input rounded-lg text-sm">
                  <option value="EDITOR" style={{ background: '#1a1a2e' }}>Editor</option>
                  <option value="VIEWER" style={{ background: '#1a1a2e' }}>Viewer</option>
                  <option value="ADMIN" style={{ background: '#1a1a2e' }}>Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-[#546e7a] mb-1">Divisi</label>
                <select value={newUser.divisionId} onChange={(e) => setNewUser(p => ({ ...p, divisionId: e.target.value }))}
                  className="w-full px-3 py-2 glass-input rounded-lg text-sm">
                  <option value="" style={{ background: '#1a1a2e' }}>Tanpa divisi</option>
                  {divisions.map(d => (
                    <option key={d.id} value={d.id} style={{ background: '#1a1a2e' }}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button onClick={handleAddUser} className="w-full px-4 py-2 glass-btn-success rounded-lg text-sm">Simpan</button>
              </div>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="overflow-auto aero-scroll">
          <table className="aero-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Nama</th>
                <th>Role</th>
                <th>Divisi</th>
                <th>Bergabung</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="group/tr">
                  <td className="text-xs font-medium">{u.username}</td>
                  <td className="text-xs">{u.name}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                      u.role === 'ADMIN'
                        ? 'bg-[#ba68c8]/15 text-[#ce93d8] border border-[#ba68c8]/30'
                        : u.role === 'VIEWER'
                          ? 'bg-[#81c784]/15 text-[#a5d6a7] border border-[#81c784]/30'
                          : 'bg-[#64b5f6]/15 text-[#90caf9] border border-[#64b5f6]/30'
                    }`}>
                      {u.role === 'ADMIN' ? <Shield className="w-3 h-3" /> : u.role === 'VIEWER' ? <Eye className="w-3 h-3" /> : <Edit className="w-3 h-3" />}
                      {u.role}
                    </span>
                  </td>
                  <td>
                    {u.division ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: u.division.color }} />
                        {u.division.name}
                      </span>
                    ) : (
                      <span className="text-[#546e7a] text-xs">-</span>
                    )}
                  </td>
                  <td className="text-[11px] text-[#546e7a]">
                    {new Date(u.createdAt).toLocaleDateString('id-ID')}
                  </td>
                  <td>
                    {u.id !== currentUser?.id && (
                      <button onClick={() => setDeleteUserTarget(u)}
                        className="p-1.5 rounded-md hover:bg-[#ef5350]/10 text-[#37474f] hover:text-[#ef5350] transition-colors opacity-0 group-hover/tr:opacity-100"
                        title="Hapus pengguna">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
