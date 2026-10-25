import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { MathText } from '../components/MathText';
import { LETTERS, OptionBody, QuestionBody } from '../components/shared';
import type { AttemptView } from '../types';
import { ErrorBox, Loading, useLoad, useUi } from '../ui';
import { fmtDate, fmtDuration, scoreClass } from '../utils';

export function Result() {
  const { id } = useParams();
  const nav = useNavigate();
  const { zoom } = useUi();
  const { data: a, error } = useLoad(() => api.get<AttemptView>(`/attempts/${id}`), [id]);

  useEffect(() => { if (a && !a.submitted_at) nav(`/take/${id}`, { replace: true }); }, [a, id, nav]);
  if (error) return <ErrorBox error={error} />;
  if (!a || !a.submitted_at) return <Loading />;
  const reveal = a.questions.some((q) => q.correct_index !== undefined);

  return (
    <>
      <p><Link to={`/exam/${a.exam.id}`}>← {a.exam.title}</Link></p>
      <div className="card result-hero">
        <div className="muted">Điểm của bạn</div>
        <div className={'big ' + scoreClass(a.score10)}>{a.score10}<small>/10</small></div>
        <p style={{ margin: '10px 0 0' }}>Đúng <strong>{a.correct_count}/{a.total_count}</strong> câu · {a.score}/{a.max_score} điểm · Nộp lúc {fmtDate(a.submitted_at)}</p>
        <p className="muted" style={{ margin: '6px 0 0' }}>
          Bắt đầu {fmtDate(a.started_at)} · Thời gian làm bài: <strong>{fmtDuration(new Date(a.submitted_at).getTime() - new Date(a.started_at).getTime())}</strong>
          {' '}(giới hạn {fmtDuration(new Date(a.deadline_at).getTime() - new Date(a.started_at).getTime())})
        </p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <Link className="btn" to="/history">Lịch sử làm bài</Link>
          <Link className="btn primary" to={`/exam/${a.exam.id}`}>Về bài thi</Link>
        </div>
      </div>
      <div className="take review" style={{ marginTop: 20 }}>
        <div className="stack">
          {a.questions.map((q) => (
            <div key={q.id} className="card question" id={`q${q.id}`}>
              <div className="q-head"><span className="q-no">Câu {q.no}</span>
                <span className={'tag ' + (q.is_correct ? 'approved' : 'rejected')}>{q.is_correct ? 'Đúng' : q.selected === undefined ? 'Bỏ trống' : 'Sai'}</span></div>
              <QuestionBody q={q} />
              <div className="options">
                {q.options.map((o, i) => {
                  let cls = '';
                  if (reveal && i === q.correct_index) cls = 'right';
                  else if (i === q.selected) cls = q.is_correct ? 'right' : reveal ? 'wrongsel' : 'sel';
                  return <div key={i} className={'opt ' + cls}><span className="letter">{LETTERS[i]}</span><OptionBody o={o} /></div>;
                })}
              </div>
              {reveal && (q.explanation || q.explanation_image) && (
                <div className="explain">
                  <strong>Lời giải: </strong>{q.explanation && <MathText text={q.explanation} />}
                  {q.explanation_image && <div><img className="explain-image" src={q.explanation_image} alt="" onClick={() => zoom(q.explanation_image!)} /></div>}
                </div>
              )}
            </div>
          ))}
        </div>
        <aside className="card take-side">
          <div className="small muted" style={{ textAlign: 'center' }}>Bảng câu trả lời</div>
          <div className="navgrid">
            {a.questions.map((q) => (
              <button key={q.id} className={q.is_correct ? 'correct' : 'wrong'}
                onClick={() => document.getElementById(`q${q.id}`)?.scrollIntoView({ behavior: 'smooth' })}>{q.no}</button>
            ))}
          </div>
          {!reveal && <p className="small muted" style={{ textAlign: 'center' }}>Đáp án đúng đã được ẩn bởi người ra đề.</p>}
        </aside>
      </div>
    </>
  );
}
