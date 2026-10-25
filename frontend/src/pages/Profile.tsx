import { useState, type FormEvent } from 'react';
import { api, errMsg } from '../api';
import { useAuth } from '../auth';
import type { User } from '../types';
import { useUi } from '../ui';

export function Profile() {
  const { user, setUser } = useAuth();
  const { toast } = useUi();
  const [info, setInfo] = useState({ full_name: user!.full_name, email: user!.email });
  const [pw, setPw] = useState({ old_password: '', new_password: '' });

  const saveInfo = async (e: FormEvent) => {
    e.preventDefault();
    try { setUser(await api.put<User>('/auth/me', info)); toast('Đã lưu'); } catch (err) { toast(errMsg(err), true); }
  };
  const savePw = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.put('/auth/me/password', pw); toast('Đã đổi mật khẩu'); setPw({ old_password: '', new_password: '' }); }
    catch (err) { toast(errMsg(err), true); }
  };

  return (
    <>
      <div className="page-head"><div><h1>Tài khoản</h1>
        <p>@{user!.username} · {user!.role === 'admin' ? <span className="tag admin">Admin</span> : 'Người dùng'}</p></div></div>
      <div className="grid">
        <form className="card" onSubmit={saveInfo}><h3>Thông tin cá nhân</h3>
          <div className="field"><label>Họ và tên</label><input value={info.full_name} onChange={(e) => setInfo({ ...info, full_name: e.target.value })} required /></div>
          <div className="field"><label>Email</label><input type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></div>
          <button className="btn primary">Lưu</button>
        </form>
        <form className="card" onSubmit={savePw}><h3>Đổi mật khẩu</h3>
          <div className="field"><label>Mật khẩu hiện tại</label><input type="password" value={pw.old_password} onChange={(e) => setPw({ ...pw, old_password: e.target.value })} required /></div>
          <div className="field"><label>Mật khẩu mới</label><input type="password" minLength={6} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required /></div>
          <button className="btn primary">Đổi mật khẩu</button>
        </form>
      </div>
    </>
  );
}
