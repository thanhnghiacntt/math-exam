import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errMsg } from '../api';
import { AttemptTable } from '../components/shared';
import type { ExamDetail } from '../types';
import { ErrorBox, Loading, useLoad, useUi } from '../ui';
import { fmtDate, VIS_LABEL } from '../utils';

export function ExamInfo() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUi();
  const { data: e, error } = useLoad(() => api.get<ExamDetail>(`/exams/${id}`), [id]);
  if (error) return <ErrorBox error={error} />;
  if (!e) return <Loading />;

  const inProgress = e.attempts.find((a) => !a.submitted_at);
  const canStart = inProgress || !(e.max_attempts > 0 && e.attempts.length >= e.max_attempts);

  const start = async () => {
    if (!inProgress && !(await confirm(`Bắt đầu làm bài trong ${e.duration_minutes} phút?`, 'Bắt đầu'))) return;
    try {
      const r = await api.post<{ attempt_id: number }>(`/exams/${id}/start`);
      nav(`/take/${r.attempt_id}`);
    } catch (err) { toast(errMsg(err), true); }
  };

  return (
    <>
      <p><Link to="/">← Danh sách bài thi</Link></p>
      <div className="card">
        <span className={'tag ' + e.visibility}>{VIS_LABEL[e.visibility]}</span>
        <h1 style={{ marginTop: 8 }}>{e.title}</h1>
        {e.description && <p style={{ whiteSpace: 'pre-wrap' }}>{e.description}</p>}
        <div className="stats" style={{ margin: '16px 0' }}>
          <div className="stat"><div className="v">{e.question_count}</div><div className="l">Câu hỏi</div></div>
          <div className="stat"><div className="v">{e.duration_minutes}'</div><div className="l">Thời gian</div></div>
          <div className="stat"><div className="v">{e.max_attempts || '∞'}</div><div className="l">Số lượt tối đa</div></div>
          <div className="stat"><div className="v">{e.attempts.length}</div><div className="l">Bạn đã làm</div></div>
        </div>
        {(e.start_at || e.end_at) && <p className="small muted">Mở: {fmtDate(e.start_at)} · Đóng: {fmtDate(e.end_at)}</p>}
        <div className="row">
          {canStart
            ? <button className="btn primary" onClick={start}>{inProgress ? 'Tiếp tục làm bài' : 'Bắt đầu làm bài'}</button>
            : <span className="tag">Bạn đã hết lượt làm bài</span>}
          <span className="small muted">Đồng hồ chạy ngay khi bấm. Bài được lưu tự động và tự nộp khi hết giờ.</span>
        </div>
      </div>
      {e.attempts.length > 0 && <><h2 style={{ marginTop: 28 }}>Các lượt đã làm</h2><AttemptTable rows={e.attempts} /></>}
    </>
  );
}
