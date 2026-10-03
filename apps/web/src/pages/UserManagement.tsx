import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useUIStore } from '../stores/uiStore';
import CustomDropdown from '../components/CustomDropdown';

export default function UserManagement() {
  const { ztteam_showToast, ztteam_showConfirm } = useUIStore();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    role: 'EDITOR'
  });

  const ztteam_fetchUsers = async () => {
    try {
      setIsLoading(true);
      const res = await api.get('/users');
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (error) {
      ztteam_showToast('Không thể tải danh sách người dùng', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    ztteam_fetchUsers();
  }, []);

  const ztteam_handleOpenModal = (user?: any) => {
    if (user) {
      setEditingUser(user);
      setFormData({ email: user.email, password: '', role: user.role });
    } else {
      setEditingUser(null);
      setFormData({ email: '', password: '', role: 'EDITOR' });
    }
    setIsModalOpen(true);
  };

  const ztteam_handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          role: formData.role,
          ...(formData.password ? { password: formData.password } : {})
        });
        ztteam_showToast('Cập nhật người dùng thành công', 'success');
      } else {
        await api.post('/users', formData);
        ztteam_showToast('Thêm người dùng thành công', 'success');
      }
      setIsModalOpen(false);
      ztteam_fetchUsers();
    } catch (error: any) {
      ztteam_showToast(error.response?.data?.message || 'Có lỗi xảy ra', 'error');
    }
  };

  const ztteam_handleDeleteUser = async (id: string, email: string) => {
    const confirm = await ztteam_showConfirm(
      'Xóa người dùng',
      `Bạn có chắc chắn muốn xóa tài khoản "${email}" không?`
    );
    if (!confirm) return;
    try {
      await api.delete(`/users/${id}`);
      ztteam_showToast('Đã xóa người dùng thành công', 'success');
      ztteam_fetchUsers();
    } catch (error) {
      ztteam_showToast('Không thể xóa người dùng', 'error');
    }
  };

  return (
    <div className="w-full space-y-6">
      {/** Header Banner: Tiêu đề & Thêm mới */}
      <div className="bg-fb-surface rounded-2xl shadow-lg p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-fb-text tracking-tight">Quản Lý Người Dùng</h2>
          <p className="text-xs sm:text-sm font-medium text-fb-text-muted mt-1">Phân quyền nhân sự, tạo và quản lý tài khoản thành viên hệ thống.</p>
        </div>
        <button 
          onClick={() => ztteam_handleOpenModal()}
          className="bg-gradient-to-r from-fb-blue to-cyan-500 text-white px-4 py-2.5 rounded-full text-xs font-bold shadow-md hover:opacity-95 transition-all flex items-center justify-center gap-1.5 w-full sm:w-auto shrink-0"
        >
          <span className="material-symbols-outlined text-base">person_add</span>
          <span>Thêm Người Dùng</span>
        </button>
      </div>

      {/** Bảng Danh Sách Người Dùng */}
      <div className="bg-fb-surface rounded-2xl overflow-hidden shadow-lg">
        {isLoading ? (
          <div className="py-16 text-center text-fb-text-muted">
            <span className="material-symbols-outlined animate-spin text-3xl mb-2 text-blue-400">sync</span>
            <p className="text-xs font-bold">Đang tải danh sách người dùng...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[600px] sm:min-w-0">
              <thead className="bg-fb-surface-hover/70 text-fb-text-muted uppercase text-[10px] font-black">
                <tr>
                  <th className="py-3 px-4 sm:px-6">Người Dùng</th>
                  <th className="py-3 px-4 sm:px-6 text-center">Vai Trò</th>
                  <th className="py-3 px-4 sm:px-6 text-center">Ngày Tạo</th>
                  <th className="py-3 px-4 sm:px-6 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(user => {
                  const initial = user.email ? user.email[0].toUpperCase() : 'U';
                  const isRoleAdmin = user.role === 'ADMIN';
                  const isRoleManager = user.role === 'MANAGER';

                  return (
                    <tr key={user.id} className="hover:bg-fb-surface-hover/50 transition-colors">
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md shrink-0 ${
                            isRoleAdmin ? 'bg-gradient-to-br from-blue-500 to-fb-blue' :
                            isRoleManager ? 'bg-gradient-to-br from-emerald-400 to-teal-600' :
                            'bg-gradient-to-br from-cyan-400 to-blue-600'
                          }`}>
                            {initial}
                          </div>
                          <span className="font-extrabold text-sm text-fb-text truncate max-w-[200px] sm:max-w-none">{user.email}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold shadow-sm ${
                          isRoleAdmin ? 'bg-blue-500/15 text-blue-400' :
                          isRoleManager ? 'bg-emerald-500/15 text-emerald-400' :
                          'bg-cyan-500/15 text-cyan-400'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-center font-medium text-fb-text-muted">
                        {new Date(user.created_at).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button 
                            onClick={() => ztteam_handleOpenModal(user)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-fb-text-muted bg-fb-surface-hover hover:text-white hover:bg-fb-surface-hover/80 transition-colors"
                            title="Chỉnh sửa người dùng"
                          >
                            <span className="material-symbols-outlined text-base">edit</span>
                          </button>
                          <button 
                            onClick={() => ztteam_handleDeleteUser(user.id, user.email)}
                            className="w-8 h-8 rounded-full flex items-center justify-center text-red-400 bg-red-500/15 hover:bg-red-500 hover:text-white transition-colors"
                            title="Xóa người dùng"
                          >
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-fb-text-muted italic">
                      Chưa có người dùng nào trong hệ thống.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/** Modal Thêm/Sửa Người Dùng (Dark Theme) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-fb-surface w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-xl">manage_accounts</span>
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-fb-text">
                    {editingUser ? 'Chỉnh Sửa Người Dùng' : 'Thêm Người Dùng Mới'}
                  </h3>
                  <p className="text-xs text-fb-text-muted mt-0.5">Nhập thông tin tài khoản và phân quyền</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-fb-surface-hover text-fb-text-muted hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            
            <form onSubmit={ztteam_handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-fb-text-muted mb-1.5 uppercase tracking-wider">Email</label>
                <input 
                  type="email" 
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  disabled={!!editingUser}
                  placeholder="name@company.com"
                  className="w-full bg-fb-surface-hover text-fb-text rounded-full px-4 py-2.5 text-xs placeholder:text-fb-text-muted/60 focus:outline-none focus:ring-2 focus:ring-fb-blue transition-colors disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fb-text-muted mb-1.5 uppercase tracking-wider">
                  Mật khẩu {editingUser && '(Bỏ trống nếu không đổi)'}
                </label>
                <input 
                  type="password" 
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  placeholder="••••••••"
                  className="w-full bg-fb-surface-hover text-fb-text rounded-full px-4 py-2.5 text-xs placeholder:text-fb-text-muted/60 focus:outline-none focus:ring-2 focus:ring-fb-blue transition-colors"
                  required={!editingUser}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-fb-text-muted mb-1.5 uppercase tracking-wider">Vai trò</label>
                <CustomDropdown
                  value={formData.role}
                  onChange={(val) => setFormData({ ...formData, role: val })}
                  options={[
                    { value: 'ADMIN', label: 'Admin (Toàn quyền)' },
                    { value: 'MANAGER', label: 'Manager (Quản lý)' },
                    { value: 'EDITOR', label: 'Editor (Biên tập)' }
                  ]}
                  className="w-full mb-2"
                />

                <div className="text-xs text-fb-text-muted bg-fb-surface-hover/50 p-3 rounded-2xl space-y-1">
                  {formData.role === 'ADMIN' && (
                    <p><strong className="text-blue-400">Admin:</strong> Toàn quyền truy cập hệ thống. Được phép thêm User, Cài đặt hệ thống và phân quyền.</p>
                  )}
                  {formData.role === 'MANAGER' && (
                    <p><strong className="text-emerald-400">Manager:</strong> Có quyền cấu hình và quản lý Fanpage, AI Factory, Website. Không thể quản lý User hay System Settings.</p>
                  )}
                  {formData.role === 'EDITOR' && (
                    <p><strong className="text-cyan-400">Editor:</strong> Chỉ thao tác, đăng bài trên các Fanpage/Website được phân công. Không được thay đổi cấu hình gốc.</p>
                  )}
                </div>
              </div>
              
              <div className="pt-2 flex justify-end gap-3 text-xs font-bold">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full bg-fb-surface-hover text-fb-text-muted hover:text-white transition-colors"
                >
                  Hủy bỏ
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 rounded-full bg-gradient-to-r from-fb-blue to-cyan-500 text-white shadow-md hover:opacity-90 transition-all"
                >
                  {editingUser ? 'Lưu thay đổi' : 'Tạo mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
