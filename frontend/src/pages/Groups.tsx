import { api, errMsg } from '../api';
import type { UserGroup } from '../types';
import { ErrorBox, Loading, useLoad, useUi } from '../ui';
import { STATUS_LABEL, TYPE_LABEL } from '../utils';

export function Groups() {
  const { data, error, setData } = useLoad(() => api.get<UserGroup[]>('/groups'));
  const { toast, confirm } = useUi();
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  const update = (id: number, patch: Partial<UserGroup>) => setData(data.map((g) => (g.id === id ? { ...g, ...patch } : g)));

  const join = async (g: UserGroup) => {
    try { await api.post(`/groups/${g.id}/join`); update(g.id, { my_status: 'pending' }); toast('Đã gửi yêu cầu, chờ admin duyệt'); }
    catch (e) { toast(errMsg(e), true); }
  };
  const leave = async (g: UserGroup) => {
    if (g.my_status === 'approved' && !(await confirm(`Rời khỏi "${g.name}"? Bạn sẽ không thấy bài thi của nhóm này nữa.`, 'Rời', true))) return;
    try {
      await api.del(`/groups/${g.id}/membership`);
      update(g.id, { my_status: null, member_count: g.member_count - (g.my_status === 'approved' ? 1 : 0) });
    } catch (e) { toast(errMsg(e), true); }
  };

  const action = (g: UserGroup) => {
    if (g.my_status === 'approved') return <button className="btn sm danger" onClick={() => leave(g)}>Rời {g.type === 'class' ? 'lớp' : 'nhóm'}</button>;
    if (g.my_status === 'pending') return <button className="btn sm" onClick={() => leave(g)}>Huỷ yêu cầu</button>;
    if (!g.open) return <span className="small muted">Không nhận đăng ký</span>;
    return <button className="btn sm primary" onClick={() => join(g)}>{g.my_status === 'rejected' ? 'Gửi lại yêu cầu' : 'Đăng ký tham gia'}</button>;
  };

  return (
    <>
      <div className="page-head"><div><h1>Nhóm & Lớp học</h1>
        <p>Đăng ký tham gia — sau khi admin duyệt, bạn sẽ thấy các bài thi được giao cho nhóm/lớp.</p></div></div>
      <div className="grid">
        {data.length ? data.map((g) => (
          <div key={g.id} className="card exam-card">
            <div className="row">
              <span className={'tag ' + g.type}>{TYPE_LABEL[g.type]}</span>
              {g.my_status && <span className={'tag ' + g.my_status}>{STATUS_LABEL[g.my_status]}</span>}
            </div>
            <h3>{g.name}</h3>
            {g.description && <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{g.description}</div>}
            <div className="meta"><span>👥 {g.member_count} thành viên</span><span>📝 {g.exam_count} bài thi</span></div>
            <div className="foot"><span />{action(g)}</div>
          </div>
        )) : <div className="card empty" style={{ gridColumn: '1/-1' }}>Chưa có nhóm/lớp nào.</div>}
      </div>
    </>
  );
}
