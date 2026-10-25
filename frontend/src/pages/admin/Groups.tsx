import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth';
import type { AdminGroup, GroupDetail, GroupMemberRow, GroupType } from '../../types';
import { ErrorBox, Loading, Modal, useLoad, useUi } from '../../ui';
import { fmtDate, TYPE_LABEL, VIS_LABEL } from '../../utils';

type GroupForm = { name: string; description: string; type: GroupType; open: boolean };

function GroupModal({ title, initial, onSave, onClose }: {
  title: string; initial: GroupForm; onSave: (f: GroupForm) => Promise<void>; onClose: () => void;
}) {
  const [f, setF] = useState(initial);
  const { toast } = useUi();
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try { await onSave(f); onClose(); } catch (err) { toast(errMsg(err), true); }
  };
  return (
    <Modal onClose={onClose}>
      <h2>{title}</h2>
      <form onSubmit={submit}>
        <div className="field"><label>Tên</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></div>
        <div className="field"><label>Loại</label>
          <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as GroupType })}>
            <option value="class">Lớp học</option><option value="group">Nhóm</option></select></div>
        <div className="field"><label>Mô tả</label><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <label className="check"><input type="checkbox" checked={f.open} onChange={(e) => setF({ ...f, open: e.target.checked })} /> Cho phép user gửi yêu cầu tham gia</label>
        <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Huỷ</button><button className="btn primary">Lưu</button></div>
      </form>
    </Modal>
  );
}

export function GroupsAdmin() {
  const nav = useNavigate();
  const { data, error } = useLoad(() => api.get<AdminGroup[]>('/admin/groups'));
  const [adding, setAdding] = useState(false);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <div className="page-head"><div><h1>Nhóm & Lớp học</h1><p>Tạo nhóm/lớp, duyệt thành viên, giao bài thi cho cả nhóm.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Tạo nhóm / lớp</button></div>
      <div className="grid">
        {data.length ? data.map((g) => (
          <Link key={g.id} className="card exam-card" to={`/admin/groups/${g.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="row">
              <span className={'tag ' + g.type}>{TYPE_LABEL[g.type]}</span>
              {!g.open && <span className="tag">Đóng đăng ký</span>}
              {g.pending_count > 0 && <span className="tag pending">{g.pending_count} chờ duyệt</span>}
            </div>
            <h3>{g.name}</h3>
            {g.description && <div className="small muted">{g.description}</div>}
            <div className="meta"><span>👥 {g.member_count} thành viên</span><span>📝 {g.exam_count} bài thi</span></div>
          </Link>
        )) : <div className="card empty" style={{ gridColumn: '1/-1' }}>Chưa có nhóm/lớp nào.</div>}
      </div>
      {adding && <GroupModal title="Tạo nhóm / lớp" initial={{ name: '', description: '', type: 'class', open: true }}
        onClose={() => setAdding(false)}
        onSave={async (f) => { const g = await api.post<AdminGroup>('/admin/groups', f); nav(`/admin/groups/${g.id}`); }} />}
    </>
  );
}

export function GroupDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUi();
  const { refreshPending } = useAuth();
  const { data: d, error, reload } = useLoad(() => api.get<GroupDetail>(`/admin/groups/${id}/members`), [id]);
  const [editing, setEditing] = useState(false);
  const [addName, setAddName] = useState('');
  if (error) return <ErrorBox error={error} />;
  if (!d) return <Loading />;
  const g = d.group;
  const pending = d.members.filter((m) => m.status === 'pending');
  const approved = d.members.filter((m) => m.status === 'approved');
  const rejected = d.members.filter((m) => m.status === 'rejected');

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try { await fn(); if (msg) toast(msg); reload(); refreshPending(); } catch (e) { toast(errMsg(e), true); }
  };
  const decide = (uid: number, action: 'approve' | 'reject') => run(() => api.post(`/admin/groups/${id}/members/${uid}/${action}`));
  const remove = async (uid: number) => {
    if (await confirm('Xoá thành viên này khỏi nhóm?', 'Xoá', true)) run(() => api.del(`/admin/groups/${id}/members/${uid}`));
  };

  const rows = (list: GroupMemberRow[], actions: (m: GroupMemberRow) => ReactNode) => (
    <table style={{ marginTop: 10 }}><tbody>{list.map((m) => (
      <tr key={m.id}>
        <td><strong>{m.full_name}</strong><div className="small muted">@{m.username}</div></td>
        <td className="small hide-sm">{fmtDate(m.status === 'pending' ? m.requested_at : m.decided_at || m.requested_at)}</td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{actions(m)}</td>
      </tr>
    ))}</tbody></table>
  );

  return (
    <>
      <p><Link to="/admin/groups">← Nhóm & Lớp</Link></p>
      <div className="page-head">
        <div><span className={'tag ' + g.type}>{TYPE_LABEL[g.type]}</span><h1 style={{ marginTop: 6 }}>{g.name}</h1>{g.description && <p>{g.description}</p>}</div>
        <div className="row">
          <button className="btn" onClick={() => setEditing(true)}>Sửa</button>
          <button className="btn danger" onClick={async () => {
            if (!(await confirm(`Xoá "${g.name}"? Thành viên sẽ mất quyền xem các bài thi giao qua nhóm này.`, 'Xoá', true))) return;
            await api.del(`/admin/groups/${id}`); toast('Đã xoá'); nav('/admin/groups');
          }}>Xoá</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Chờ duyệt ({pending.length})</h3>
          {pending.length > 1 && <button className="btn sm success" onClick={() => run(() => api.post('/admin/requests/bulk', {
            action: 'approve', items: pending.map((m) => ({ group_id: g.id, user_id: m.id })),
          }), `Đã duyệt ${pending.length} yêu cầu`)}>Duyệt tất cả</button>}
        </div>
        {pending.length ? rows(pending, (m) => <>
          <button className="btn sm success" onClick={() => decide(m.id, 'approve')}>Duyệt</button>{' '}
          <button className="btn sm danger" onClick={() => decide(m.id, 'reject')}>Từ chối</button>
        </>) : <p className="muted small">Không có yêu cầu nào.</p>}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Thành viên ({approved.length})</h3>
          <form className="row" onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/admin/groups/${id}/members`, { username: addName }), 'Đã thêm').then(() => setAddName('')); }}>
            <input placeholder="Username cần thêm" style={{ width: 190 }} value={addName} onChange={(e) => setAddName(e.target.value)} required />
            <button className="btn sm primary">Thêm trực tiếp</button>
          </form>
        </div>
        {approved.length ? rows(approved, (m) => <button className="btn sm danger" onClick={() => remove(m.id)}>Xoá khỏi nhóm</button>)
          : <p className="muted small">Chưa có thành viên.</p>}
      </div>

      {rejected.length > 0 && (
        <div className="card"><h3>Đã từ chối ({rejected.length})</h3>
          {rows(rejected, (m) => <>
            <button className="btn sm success" onClick={() => decide(m.id, 'approve')}>Duyệt lại</button>{' '}
            <button className="btn sm" onClick={() => remove(m.id)}>Xoá</button>
          </>)}
        </div>
      )}

      <div className="card">
        <h3>Bài thi giao cho {g.type === 'class' ? 'lớp' : 'nhóm'} này ({d.exams.length})</h3>
        {d.exams.length ? d.exams.map((e) => (
          <div key={e.id} className="row" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
            <Link to={`/admin/exams/${e.id}/edit`} className="grow">{e.title}</Link>
            <span className={'tag ' + e.visibility}>{VIS_LABEL[e.visibility]}</span>
          </div>
        )) : <p className="muted small">Chưa có. Khi tạo/sửa đề thi, chọn chế độ "Giới hạn" và tick nhóm/lớp này.</p>}
      </div>

      {editing && <GroupModal title="Sửa nhóm / lớp" initial={{ name: g.name, description: g.description, type: g.type, open: g.open }}
        onClose={() => setEditing(false)} onSave={async (f) => { await api.put(`/admin/groups/${id}`, f); reload(); }} />}
    </>
  );
}
