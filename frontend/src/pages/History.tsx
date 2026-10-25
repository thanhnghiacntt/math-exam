import { Link } from 'react-router-dom';
import { api } from '../api';
import { AttemptTable } from '../components/shared';
import type { History } from '../types';
import { ErrorBox, Loading, useLoad } from '../ui';
import { scoreClass } from '../utils';

export function HistoryPage() {
  const { data: h, error } = useLoad(() => api.get<History>('/history'));
  if (error) return <ErrorBox error={error} />;
  if (!h) return <Loading />;
  const s = h.summary;
  return (
    <>
      <div className="page-head"><div><h1>Lịch sử làm bài</h1><p>Điểm quy đổi về thang 10.</p></div></div>
      <div className="stats">
        <div className="stat"><div className="v">{s.total_attempts}</div><div className="l">Lượt đã nộp</div></div>
        <div className="stat"><div className="v">{s.exams_taken}</div><div className="l">Bài thi đã làm</div></div>
        <div className="stat"><div className={'v ' + scoreClass(s.average10)}>{s.average10 ?? '—'}</div><div className="l">Điểm trung bình</div></div>
        <div className="stat"><div className={'v ' + scoreClass(s.best10)}>{s.best10 ?? '—'}</div><div className="l">Điểm cao nhất</div></div>
      </div>
      {h.attempts.length ? <AttemptTable rows={h.attempts} withExam />
        : <div className="card empty">Bạn chưa làm bài thi nào. <Link to="/">Chọn bài thi</Link></div>}
    </>
  );
}
