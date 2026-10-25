import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth';
import type { AdminExamRow, Stats } from '../../types';
import { ErrorBox, Loading, useLoad } from '../../ui';
import { ExamTable } from './ExamsAdmin';

export function Dashboard() {
  const { refreshPending } = useAuth();
  const { data, error } = useLoad(() => Promise.all([api.get<Stats>('/admin/stats'), api.get<AdminExamRow[]>('/admin/exams')]));
  useEffect(() => { refreshPending(); }, [refreshPending]);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const [s, exams] = data;
  return (
    <>
      <div className="page-head"><div><h1>Tổng quan</h1><p>Quản trị hệ thống thi trắc nghiệm.</p></div>
        <Link className="btn primary" to="/admin/exams/new">+ Tạo đề thi</Link></div>
      <div className="stats">
        <Link className="stat" to="/admin/users"><div className="v">{s.users}</div><div className="l">Người dùng · {s.admins} admin</div></Link>
        <Link className="stat" to="/admin/exams"><div className="v">{s.exams}</div><div className="l">Đề thi · {s.published} đã đăng</div></Link>
        <Link className="stat" to="/admin/groups"><div className="v">{s.groups}</div><div className="l">Nhóm / Lớp</div></Link>
        <Link className="stat" to="/admin/requests"><div className={'v ' + (s.pending ? 'score-mid' : '')}>{s.pending}</div><div className="l">Yêu cầu chờ duyệt</div></Link>
        <div className="stat"><div className="v">{s.attempts}</div><div className="l">Lượt thi đã nộp</div></div>
      </div>
      <h2>Đề thi gần đây</h2>
      <ExamTable exams={exams.slice(0, 6)} />
    </>
  );
}
