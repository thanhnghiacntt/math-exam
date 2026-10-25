import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../../api';
import { useAuth } from '../../auth';
import type { JoinRequest } from '../../types';
import { ErrorBox, Loading, useLoad, useUi } from '../../ui';
import { fmtDate, TYPE_LABEL } from '../../utils';

const key = (r: JoinRequest) => `${r.group_id}:${r.user_id}`;

export function Requests() {
  const { data, error, reload } = useLoad(() => api.get<JoinRequest[]>('/admin/requests'));
  const { toast } = useUi();
  const { refreshPending } = useAuth();
  const [sel, setSel] = useState<Set<string>>(new Set());
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;

  const bulk = async (items: JoinRequest[], action: 'approve' | 'reject') => {
    if (!items.length) return toast('Chưa chọn mục nào', true);
    try {
      await api.post('/admin/requests/bulk', { action, items: items.map((r) => ({ group_id: r.group_id, user_id: r.user_id })) });
      toast(`${action === 'approve' ? 'Đã duyệt' : 'Đã từ chối'} ${items.length} yêu cầu`);
      setSel(new Set()); reload(); refreshPending();
    } catch (e) { toast(errMsg(e), true); }
  };
  const selected = data.filter((r) => sel.has(key(r)));
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <>
      <div className="page-head"><div><h1>Duyệt tham gia nhóm / lớp</h1><p>{data.length} yêu cầu đang chờ.</p></div>
        {data.length > 0 && <div className="row">
          <button className="btn success" onClick={() => bulk(selected, 'approve')}>Duyệt mục đã chọn</button>
          <button className="btn danger" onClick={() => bulk(selected, 'reject')}>Từ chối mục đã chọn</button>
        </div>}
      </div>
      {data.length ? (
        <div className="table-wrap"><table>
          <thead><tr>
            <th><input type="checkbox" checked={sel.size === data.length} onChange={(e) => setSel(e.target.checked ? new Set(data.map(key)) : new Set())} /></th>
            <th>Người dùng</th><th>Nhóm / lớp</th><th className="hide-sm">Gửi lúc</th><th />
          </tr></thead>
          <tbody>{data.map((r) => (
            <tr key={key(r)}>
              <td><input type="checkbox" checked={sel.has(key(r))} onChange={() => toggle(key(r))} /></td>
              <td><strong>{r.full_name}</strong><div className="small muted">@{r.username}</div></td>
              <td><span className={'tag ' + r.group_type}>{TYPE_LABEL[r.group_type]}</span> <Link to={`/admin/groups/${r.group_id}`}>{r.group_name}</Link></td>
              <td className="small hide-sm">{fmtDate(r.requested_at)}</td>
              <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <button className="btn sm success" onClick={() => bulk([r], 'approve')}>Duyệt</button>{' '}
                <button className="btn sm danger" onClick={() => bulk([r], 'reject')}>Từ chối</button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="card empty">🎉 Không còn yêu cầu nào cần duyệt.</div>}
    </>
  );
}
