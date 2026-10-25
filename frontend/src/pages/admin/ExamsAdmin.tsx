import { Link } from 'react-router-dom';
import { api } from '../../api';
import type { AdminExamRow } from '../../types';
import { ErrorBox, Loading, useLoad } from '../../ui';
import { fmtDate, VIS_LABEL } from '../../utils';

export function ExamTable({ exams }: { exams: AdminExamRow[] }) {
  if (!exams.length) return <div className="card empty">Chưa có đề thi. <Link to="/admin/exams/new">Tạo đề đầu tiên</Link></div>;
  return (
    <div className="table-wrap"><table>
      <thead><tr><th>Đề thi</th><th>Trạng thái</th><th className="hide-sm">Giao cho</th><th className="hide-sm">Câu</th><th className="hide-sm">Lượt nộp</th><th /></tr></thead>
      <tbody>{exams.map((e) => (
        <tr key={e.id}>
          <td><strong>{e.title}</strong><div className="small muted">{e.duration_minutes} phút · tạo {fmtDate(e.created_at)}</div></td>
          <td><span className={'tag ' + e.visibility}>{VIS_LABEL[e.visibility]}</span></td>
          <td className="hide-sm small">{e.visibility === 'public' ? 'Tất cả'
            : [e.group_names, e.user_count ? `${e.user_count} user` : ''].filter(Boolean).join(' · ') || '—'}</td>
          <td className="hide-sm">{e.question_count}</td>
          <td className="hide-sm">{e.attempt_count}</td>
          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            <Link className="btn sm" to={`/admin/exams/${e.id}/results`}>Kết quả</Link>{' '}
            <Link className="btn sm" to={`/admin/exams/${e.id}/edit`}>Sửa</Link>
          </td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

export function ExamsAdmin() {
  const { data, error } = useLoad(() => api.get<AdminExamRow[]>('/admin/exams'));
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <div className="page-head"><div><h1>Đề thi</h1><p>Soạn đề, đăng công khai hoặc giao cho nhóm/lớp/user cụ thể.</p></div>
        <Link className="btn primary" to="/admin/exams/new">+ Tạo đề thi</Link></div>
      <ExamTable exams={data} />
    </>
  );
}
