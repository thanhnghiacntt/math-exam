import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errMsg } from '../api';
import { useAuth } from '../auth';
import { MathText } from '../components/MathText';
import type { User } from '../types';
import { useUi } from '../ui';

type AuthRes = { token: string; user: User };

function Shell({ title, sub, children, foot }: { title: string; sub: ReactNode; children: ReactNode; foot: ReactNode }) {
  return (
    <div className="auth-wrap"><div className="card auth-card">
      <div className="logo"><span className="brand-mark">∑</span></div>
      <h1>{title}</h1>
      <p className="auth-formula">{sub}</p>
      {children}
      <p className="small muted" style={{ textAlign: 'center', margin: '16px 0 0' }}>{foot}</p>
    </div></div>
  );
}

export function Login() {
  const { login } = useAuth();
  const { toast } = useUi();
  const nav = useNavigate();
  const [f, setF] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<AuthRes>('/auth/login', f);
      login(r.token, r.user);
      nav(r.user.role === 'admin' ? '/admin' : '/');
    } catch (err) { toast(errMsg(err), true); } finally { setBusy(false); }
  };

  return (
    <Shell title="Đăng nhập" sub={<MathText text="$e^{i\pi} + 1 = 0$" />}
      foot={<>Chưa có tài khoản? <Link to="/register">Đăng ký</Link></>}>
      <form onSubmit={submit}>
        <div className="field"><label>Tên đăng nhập</label>
          <input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" required autoFocus /></div>
        <div className="field"><label>Mật khẩu</label>
          <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" required /></div>
        <button className="btn primary" style={{ width: '100%' }} disabled={busy}>Đăng nhập</button>
      </form>
    </Shell>
  );
}

export function Register() {
  const { login } = useAuth();
  const { toast } = useUi();
  const nav = useNavigate();
  const [f, setF] = useState({ full_name: '', username: '', email: '', password: '' });
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const r = await api.post<AuthRes>('/auth/register', f);
      login(r.token, r.user);
      toast('Tạo tài khoản thành công');
      nav('/');
    } catch (err) { toast(errMsg(err), true); }
  };

  return (
    <Shell title="Tạo tài khoản" sub="Tham gia làm bài thi Toán trắc nghiệm"
      foot={<>Đã có tài khoản? <Link to="/login">Đăng nhập</Link></>}>
      <form onSubmit={submit}>
        <div className="field"><label>Họ và tên</label><input value={f.full_name} onChange={set('full_name')} required /></div>
        <div className="field"><label>Tên đăng nhập</label>
          <input value={f.username} onChange={set('username')} required pattern="[A-Za-z0-9._\-]{3,32}" title="3–32 ký tự: chữ, số, . _ -" autoComplete="username" /></div>
        <div className="field"><label>Email (không bắt buộc)</label><input type="email" value={f.email} onChange={set('email')} /></div>
        <div className="field"><label>Mật khẩu</label><input type="password" value={f.password} onChange={set('password')} minLength={6} required autoComplete="new-password" /></div>
        <button className="btn primary" style={{ width: '100%' }}>Đăng ký</button>
      </form>
    </Shell>
  );
}
