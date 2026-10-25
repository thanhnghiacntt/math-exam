import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { ExamListItem } from '../types';
import { ErrorBox, Loading, useLoad } from '../ui';
import { fmtDate, scoreClass, truncate } from '../utils';

function ExamCard({ e }: { e: ExamListItem }) {
  const now = Date.now();
  const notOpen = e.start_at && now < +new Date(e.start_at);
  const closed = e.end_at && now > +new Date(e.end_at);
  const outOfTries = e.max_attempts > 0 && e.my_attempts >= e.max_attempts && !e.in_progress_id;
  let action;
  if (e.in_progress_id) action = <Link className="btn primary" to={`/take/${e.in_progress_id}`}>Tiếp tục làm</Link>;
  else if (notOpen) action = <span className="tag pending">Mở lúc {fmtDate(e.start_at)}</span>;
  else if (closed) action = <span className="tag">Đã đóng</span>;
  else if (outOfTries) action = <span className="tag">Hết lượt</span>;
  else action = <Link className="btn primary" to={`/exam/${e.id}`}>{e.my_attempts ? 'Làm lại' : 'Vào thi'}</Link>;

  return (
    <div className="card exam-card">
      <div className="row"><span className={'tag ' + e.visibility}>{e.visibility === 'public' ? 'Công khai' : e.via_groups || 'Được giao'}</span></div>
      <h3><Link to={`/exam/${e.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>{e.title}</Link></h3>
      {e.description && <div className="small muted">{truncate(e.description, 140)}</div>}
      <div className="meta">
        <span>⏱ {e.duration_minutes} phút</span><span>📝 {e.question_count} câu</span>
        {e.max_attempts > 0 && <span>🔁 {e.my_attempts}/{e.max_attempts} lượt</span>}
        {e.end_at && <span>⏳ Hạn {fmtDate(e.end_at)}</span>}
      </div>
      <div className="foot">
        <div>{e.my_best != null
          ? <><span className="muted small">Điểm cao nhất</span> <span className={'score-pill ' + scoreClass(e.my_best)}>{e.my_best}</span></>
          : <span className="muted small">Chưa làm</span>}</div>
        {action}
      </div>
    </div>
  );
}

export function Exams() {
  const { data, error } = useLoad(() => api.get<ExamListItem[]>('/exams'));
  const [q, setQ] = useState('');
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const list = data.filter((e) => !q.trim() || e.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <div className="page-head">
        <div><h1>Bài thi của bạn</h1><p>Bài công khai và bài được giao cho bạn hoặc nhóm/lớp bạn tham gia.</p></div>
        <input placeholder="Tìm bài thi…" style={{ width: 220 }} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid">
        {list.length ? list.map((e) => <ExamCard key={e.id} e={e} />) : (
          <div className="card empty" style={{ gridColumn: '1/-1' }}>
            Chưa có bài thi nào. Hãy <Link to="/groups">đăng ký nhóm/lớp</Link> để nhận bài thi.
          </div>
        )}
      </div>
    </>
  );
}
