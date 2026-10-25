import { Link } from 'react-router-dom';
import type { AttemptQuestion, AttemptRow, Option } from '../types';
import { useUi } from '../ui';
import { fmtDate, fmtDuration, LETTERS, scoreClass } from '../utils';
import { MathText } from './MathText';

export function Score({ v, raw }: { v: number | null; raw?: string }) {
  if (v == null) return <>—</>;
  return <><span className={'score-pill ' + scoreClass(v)}>{v}</span>{raw && <span className="small muted"> ({raw})</span>}</>;
}

export function AttemptTable({ rows, withExam }: { rows: AttemptRow[]; withExam?: boolean }) {
  return (
    <div className="table-wrap"><table>
      <thead><tr>{withExam && <th>Bài thi</th>}<th>Bắt đầu</th><th className="hide-sm">Nộp lúc</th><th>Thời gian làm</th><th>Đúng</th><th>Điểm (thang 10)</th><th /></tr></thead>
      <tbody>{rows.map((a) => (
        <tr key={a.id}>
          {withExam && <td><strong>{a.exam_title}</strong></td>}
          <td>{fmtDate(a.started_at)}</td>
          <td className="hide-sm">{a.submitted_at ? fmtDate(a.submitted_at) : <span className="tag pending">Đang làm</span>}</td>
          <td>{a.submitted_at ? fmtDuration(new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime()) : '—'}</td>
          <td>{a.submitted_at ? `${a.correct_count}/${a.total_count}` : '—'}</td>
          <td>{a.submitted_at ? <Score v={a.score10} raw={`${a.score}/${a.max_score}`} /> : '—'}</td>
          <td style={{ textAlign: 'right' }}>
            {a.submitted_at
              ? <Link className="btn sm" to={`/result/${a.id}`}>Xem lại</Link>
              : <Link className="btn sm primary" to={`/take/${a.id}`}>Tiếp tục</Link>}
          </td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}

/** Nội dung đề bài: ảnh (nếu có) + văn bản có công thức */
export function QuestionBody({ q }: { q: Pick<AttemptQuestion, 'content' | 'image_url'> }) {
  const { zoom } = useUi();
  return (
    <>
      {q.content && <MathText className="q-content" text={q.content} block />}
      {q.image_url && <img className="q-image" src={q.image_url} alt="Đề bài" loading="lazy" onClick={() => zoom(q.image_url!)} />}
    </>
  );
}

export function OptionBody({ o }: { o: Option }) {
  const { zoom } = useUi();
  return (
    <span className="opt-body">
      {o.text && <MathText text={o.text} />}
      {o.image && <img className="opt-image" src={o.image} alt="" loading="lazy" onClick={(e) => { e.preventDefault(); e.stopPropagation(); zoom(o.image!); }} />}
    </span>
  );
}

export { LETTERS };
