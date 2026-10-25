import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth';
import { Score } from '../../components/shared';
import type { AdminUser, AttemptRow, Role } from '../../types';
import { ErrorBox, Loading, Modal, useLoad, useUi } from '../../ui';
import { fmtDate } from '../../utils';

function CreateUser({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const { toast } = useUi();
  const [f, setF] = useState({ full_name: '', username: '', password: '', email: '', role: 'user' as Role });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.post('/admin/users', f); toast('Đã tạo user'); onDone(); onClose(); } catch (err) { toast(errMsg(err), true); }
  };
  return (
    <Modal onClose={onClose}>
      <h2>Thêm người dùng</h2>
      <form onSubmit={submit}>
        <div className="field"><label>Họ và tên</label><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></div>
        <div className="fields-2">
          <div className="field"><label>Tên đăng nhập</label><input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required /></div>
          <div className="field"><label>Mật khẩu</label><input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} minLength={6} required /></div>
        </div>
        <div className="field"><label>Email</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>Vai trò</label>
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="user">User — làm bài thi</option><option value="admin">Admin</option>
          </select></div>
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Huỷ</button><button className="btn primary">Tạo</button></div>
      </form>
    </Modal>
  );
}

function EditUser({ u, onDone, onClose }: { u: AdminUser; onDone: () => void; onClose: () => void }) {
  const { user: me } = useAuth();
  const { toast, confirm } = useUi();
  const self = u.id === me?.id;
  const [f, setF] = useState({ full_name: u.full_name, email: u.email, role: u.role, active: u.active, password: '' });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const body: Record<string, unknown> = { full_name: f.full_name, email: f.email };
      if (!self) { body.role = f.role; body.active = f.active; }
      await api.put(`/admin/users/${u.id}`, body);
      if (f.password) await api.put(`/admin/users/${u.id}/password`, { password: f.password });
      toast('Đã cập nhật'); onDone(); onClose();
    } catch (err) { toast(errMsg(err), true); }
  };
  const del = async () => {
    onClose();
    if (!(await confirm(`Xoá vĩnh viễn "${u.username}" và toàn bộ lịch sử làm bài?`, 'Xoá', true))) return;
    try { await api.del(`/admin/users/${u.id}`); toast('Đã xoá'); onDone(); } catch (err) { toast(errMsg(err), true); }
  };

  return (
    <Modal onClose={onClose}>
      <h2>{u.full_name} <span className="small muted">@{u.username}</span></h2>
      <form onSubmit={submit}>
        <div className="field"><label>Họ và tên</label><input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></div>
        <div className="field"><label>Email</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="fields-2">
          <div className="field"><label>Vai trò</label>
            <select disabled={self} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
              <option value="user">User</option><option value="admin">Admin</option></select></div>
          <div className="field"><label>Trạng thái</label>
            <select disabled={self} value={String(f.active)} onChange={(e) => setF({ ...f, active: e.target.value === 'true' })}>
              <option value="true">Hoạt động</option><option value="false">Khoá</option></select></div>
        </div>
        {self && <p className="hint">Bạn không thể tự hạ quyền hoặc tự khoá tài khoản của mình.</p>}
        <div className="field"><label>Đặt mật khẩu mới (để trống nếu không đổi)</label>
          <input value={f.password} minLength={6} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
          {self ? <span /> : <button type="button" className="btn danger" onClick={del}>Xoá user</button>}
          <div className="row"><button type="button" className="btn" onClick={onClose}>Huỷ</button><button className="btn primary">Lưu</button></div>
        </div>
      </form>
    </Modal>
  );
}

function UserHistory({ u, onClose }: { u: AdminUser; onClose: () => void }) {
  const { data } = useLoad(() => api.get<AttemptRow[]>(`/admin/users/${u.id}/attempts`), [u.id]);
  return (
    <Modal onClose={onClose} wide>
      <h2>Lịch sử — {u.full_name}</h2>
      {!data ? <p className="muted">Đang tải…</p> : data.length ? (
        <table><thead><tr><th>Bài thi</th><th>Ngày</th><th>Điểm</th><th /></tr></thead>
          <tbody>{data.map((a) => (
            <tr key={a.id}><td>{a.exam_title}</td><td className="small">{fmtDate(a.started_at)}</td>
              <td>{a.submitted_at ? <Score v={a.score10} /> : <span className="tag pending">Đang làm</span>}</td>
              <td>{a.submitted_at && <Link className="btn sm" to={`/result/${a.id}`} onClick={onClose}>Xem</Link>}</td></tr>
          ))}</tbody></table>
      ) : <p className="muted">Chưa làm bài nào.</p>}
      <div className="modal-actions"><button className="btn" onClick={onClose}>Đóng</button></div>
    </Modal>
  );
}

export function UsersAdmin() {
  const { data, error, reload } = useLoad(() => api.get<AdminUser[]>('/admin/users'));
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<{ kind: 'new' } | { kind: 'edit' | 'hist'; u: AdminUser } | null>(null);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const t = q.trim().toLowerCase();
  const list = data.filter((u) => !t || [u.username, u.full_name, u.email].some((x) => (x || '').toLowerCase().includes(t)));
  const close = () => setModal(null);

  return (
    <>
      <div className="page-head"><div><h1>Người dùng</h1><p>Tạo tài khoản, khoá/mở, đặt lại mật khẩu, cấp quyền admin.</p></div>
        <div className="row">
          <input placeholder="Tìm tên, username, email…" style={{ width: 240 }} value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn primary" onClick={() => setModal({ kind: 'new' })}>+ Thêm user</button>
        </div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Người dùng</th><th className="hide-sm">Nhóm / lớp</th><th>Vai trò</th><th>Trạng thái</th><th className="hide-sm">Lượt thi</th><th /></tr></thead>
        <tbody>
          {list.map((u) => (
            <tr key={u.id}>
              <td><strong>{u.full_name}</strong><div className="small muted">@{u.username}{u.email && ' · ' + u.email}</div></td>
              <td className="hide-sm small">{u.groups || '—'}</td>
              <td>{u.role === 'admin' ? <span className="tag admin">Admin</span> : <span className="tag">User</span>}</td>
              <td>{u.active ? <span className="tag approved">Hoạt động</span> : <span className="tag rejected">Đã khoá</span>}</td>
              <td className="hide-sm">{u.attempt_count}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="btn sm" onClick={() => setModal({ kind: 'hist', u })}>Lịch sử</button>{' '}
                <button className="btn sm" onClick={() => setModal({ kind: 'edit', u })}>Sửa</button>
              </td>
            </tr>
          ))}
          {!list.length && <tr><td colSpan={6} className="empty">Không có kết quả</td></tr>}
        </tbody>
      </table></div>
      {modal?.kind === 'new' && <CreateUser onDone={reload} onClose={close} />}
      {modal?.kind === 'edit' && <EditUser u={modal.u} onDone={reload} onClose={close} />}
      {modal?.kind === 'hist' && <UserHistory u={modal.u} onClose={close} />}
    </>
  );
}
