'use client';

import { useState, useEffect, useCallback } from 'react';
import { Users, Building2, Plus, Shield, Edit } from 'lucide-react';

export function AdminPanel() {
  const [users, setUsers] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showAddDiv, setShowAddDiv] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', name: '', password: '', role: 'EDITOR', divisionId: '' });
  const [newDiv, setNewDiv] = useState({ name: '', color: '#6366f1' });

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
    if (!newDiv.name) return;
    try {
      const res = await fetch('/api/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newDiv),
      });
      if (res.ok) {
        setNewDiv({ name: '', color: '#6366f1' });
        setShowAddDiv(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-auto aero-scroll">
      {/* Divisions Section */}
      <div className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-[#ffb74d]" />
            <h3 className="text-sm font-semibold text-[#e3f2fd]">Manajemen Divisi</h3>
          </div>
          <button onClick={() => setShowAddDiv(!showAddDiv)} className="flex items-center gap-1 px-3 py-1.5 glass-btn rounded-lg text-xs">
            <Plus className="w-3.5 h-3.5" /> Tambah Divisi
          </button>
        </div>

        {showAddDiv && (
          <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-white/5">
            <input value={newDiv.name} onChange={(e) => setNewDiv(p => ({ ...p, name: e.target.value }))}
              className="flex-1 px-3 py-2 glass-input rounded-lg text-sm" placeholder="Nama divisi" />
            <input type="color" value={newDiv.color} onChange={(e) => setNewDiv(p => ({ ...p, color: e.target.value }))}
              className="w-10 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer" />
            <button onClick={handleAddDiv} className="px-4 py-2 glass-btn-success rounded-lg text-xs">Simpan</button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {divisions.map(div => (
            <div key={div.id} className="p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: div.color }} />
                <div>
                  <p className="text-sm font-medium">{div.name}</p>
                  <p className="text-[11px] text-[#546e7a]">{div._count.users} pengguna &middot; {div._count.columns} kolom</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Users Section */}
      <div className="glass-card rounded-xl p-5 flex-1">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#64b5f6]" />
            <h3 className="text-sm font-semibold text-[#e3f2fd]">Manajemen Pengguna</h3>
          </div>
          <button onClick={() => setShowAddUser(!showAddUser)} className="flex items-center gap-1 px-3 py-1.5 glass-btn rounded-lg text-xs">
            <Plus className="w-3.5 h-3.5" /> Tambah Pengguna
          </button>
        </div>

        {showAddUser && (
          <div className="p-4 rounded-xl bg-white/5 mb-4">
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
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="text-xs font-medium">{u.username}</td>
                  <td className="text-xs">{u.name}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] ${
                      u.role === 'ADMIN'
                        ? 'bg-[#ba68c8]/15 text-[#ce93d8] border border-[#ba68c8]/30'
                        : 'bg-[#64b5f6]/15 text-[#90caf9] border border-[#64b5f6]/30'
                    }`}>
                      {u.role === 'ADMIN' ? <Shield className="w-3 h-3" /> : <Edit className="w-3 h-3" />}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}