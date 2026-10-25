import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { Score } from '../../components/shared';
import type { AttemptRow, ExamResults } from '../../types';
import { ErrorBox, Loading, useLoad } from '../../ui';
import { fmtDate, scoreClass } from '../../utils';

function exportCsv(id: string, rows: AttemptRow[]) {
  const head = ['Username', 'Họ tên', 'Bắt đầu', 'Nộp lúc', 'Số câu đúng', 'Tổng câu', 'Điểm', 'Điểm tối đa', 'Điểm thang 10'];
  const data = rows.map((a) => [a.username, a.full_name, fmtDate(a.started_at), a.submitted_at ? fmtDate(a.submitted_at) : '',
    a.correct_count ?? '', a.total_count ?? '', a.score ?? '', a.max_score ?? '', a.score10 ?? '']);
  const csv = '﻿' + [head, ...data].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  Object.assign(document.createElement('a'), { href: url, download: `ket-qua-de-${id}.csv` }).click();
  URL.revokeObjectURL(url);
}

export function ExamResultsPage() {
  const { id } = useParams();
  const { data: r, error } = useLoad(() => api.get<ExamResults>(`/admin/exams/${id}/results`), [id]);
  const [tab, setTab] = useState<'rank' | 'all'>('rank');
  if (error) return <ErrorBox error={error} />;
  if (!r) return <Loading />;
  const s = r.summary;
  const best = new Map<number, AttemptRow>();
  r.attempts.filter((a) => a.submitted_at).forEach((a) => {
    const b = best.get(a.user_id!);
    if (!b || (a.score10 ?? 0) > (b.score10 ?? 0)) best.set(a.user_id!, a);
  });
  const ranking = [...best.values()].sort((a, b) => (b.score10 ?? 0) - (a.score10 ?? 0));

  return (
    <>
      <p><Link to="/admin/exams">← Đề thi</Link></p>
      <div className="page-head"><div><h1>Kết quả: {r.exam.title}</h1></div>
        <div className="row"><button className="btn" onClick={() => exportCsv(id!, r.attempts)}>Xuất CSV</button>
          <Link className="btn" to={`/admin/exams/${id}/edit`}>Sửa đề</Link></div></div>
      <div className="stats">
        <div className="stat"><div className="v">{s.users}</div><div className="l">Người đã làm</div></div>
        <div className="stat"><div className="v">{s.attempts}</div><div className="l">Lượt nộp</div></div>
        <div className="stat"><div className={'v ' + scoreClass(s.average10)}>{s.average10 ?? '—'}</div><div className="l">Điểm TB</div></div>
        <div className="stat"><div className="v">{s.max10 ?? '—'} / {s.min10 ?? '—'}</div><div className="l">Cao nhất / thấp nhất</div></div>
      </div>
      <div className="tabs">
        <button className={tab === 'rank' ? 'active' : ''} onClick={() => setTab('rank')}>Xếp hạng</button>
        <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Tất cả lượt ({r.attempts.length})</button>
      </div>
      {tab === 'rank' ? (ranking.length ? (
        <div className="table-wrap"><table><thead><tr><th>#</th><th>Người dùng</th><th>Điểm cao nhất</th><th>Đúng</th><th /></tr></thead>
          <tbody>{ranking.map((a, i) => (
            <tr key={a.id}><td>{i + 1}</td><td><strong>{a.full_name}</strong> <span className="small muted">@{a.username}</span></td>
              <td><Score v={a.score10} /></td><td>{a.correct_count}/{a.total_count}</td>
              <td style={{ textAlign: 'right' }}><Link className="btn sm" to={`/result/${a.id}`}>Bài làm</Link></td></tr>
          ))}</tbody></table></div>
      ) : <div className="card empty">Chưa có ai nộp bài.</div>) : (r.attempts.length ? (
        <div className="table-wrap"><table><thead><tr><th>Người dùng</th><th>Bắt đầu</th><th>Nộp</th><th>Điểm</th><th /></tr></thead>
          <tbody>{r.attempts.map((a) => (
            <tr key={a.id}><td>{a.full_name} <span className="small muted">@{a.username}</span></td>
              <td className="small">{fmtDate(a.started_at)}</td>
              <td className="small">{a.submitted_at ? fmtDate(a.submitted_at) : <span className="tag pending">Đang làm</span>}</td>
              <td>{a.submitted_at ? <Score v={a.score10} /> : '—'}</td>
              <td style={{ textAlign: 'right' }}>{a.submitted_at && <Link className="btn sm" to={`/result/${a.id}`}>Bài làm</Link>}</td></tr>
          ))}</tbody></table></div>
      ) : <div className="card empty">Chưa có lượt làm bài.</div>)}
    </>
  );
}
