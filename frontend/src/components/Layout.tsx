import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export function Layout() {
  const { user, pending, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const L = (to: string, label: ReactNode, end = false) => (
    <NavLink to={to} end={end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'active' : '')}>{label}</NavLink>
  );
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand"><span className="brand-mark">∑</span> Thi Toán</Link>
        <button className="menu-btn" aria-label="Menu" onClick={() => setOpen((o) => !o)}>☰</button>
        <nav id="nav" className={open ? 'open' : ''} key={loc.pathname}>
          {L('/', 'Bài thi', true)}
          {L('/history', 'Lịch sử')}
          {user?.role !== 'admin' && L('/groups', 'Nhóm / Lớp')}
          {user?.role === 'admin' && (
            <>
              <span className="sep" />
              {L('/admin', 'Tổng quan', true)}
              {L('/admin/exams', 'Quản lý đề thi')}
              {L('/admin/groups', 'Quản lý nhóm / lớp')}
              {L('/admin/requests', <>Duyệt tham gia{pending > 0 && <span className="badge-count">{pending}</span>}</>)}
              {L('/admin/users', 'Quản lý người dùng')}
            </>
          )}
          <span className="spacer" />
          {L('/profile', user?.full_name || user?.username)}
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); nav('/login'); }}>Đăng xuất</a>
        </nav>
      </header>
      <main><Outlet /></main>
    </>
  );
}
