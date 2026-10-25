import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, errMsg } from '../api';
import { LETTERS, OptionBody, QuestionBody } from '../components/shared';
import type { AttemptView } from '../types';
import { ErrorBox, Loading, useUi } from '../ui';
import { fmtDuration } from '../utils';

export function Take() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUi();
  const [a, setA] = useState<AttemptView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [left, setLeft] = useState(0);
  const [saveState, setSaveState] = useState('');

  const answersRef = useRef(answers);
  answersRef.current = answers;
  const dirty = useRef(false);
  const submitting = useRef(false);
  const offset = useRef(0); // lệch giờ server - client

  useEffect(() => {
    api.get<AttemptView>(`/attempts/${id}`).then((d) => {
      if (d.submitted_at) { nav(`/result/${id}`, { replace: true }); return; }
      offset.current = +new Date(d.server_now) - Date.now();
      const init: Record<string, number> = {};
      d.questions.forEach((q) => { if (q.selected !== undefined) init[q.id] = q.selected; });
      setAnswers(init);
      setA(d);
    }).catch((e) => setError(e.message));
  }, [id, nav]);

  const save = useCallback(async () => {
    if (!dirty.current || submitting.current) return;
    dirty.current = false;
    setSaveState('Đang lưu…');
    try {
      await api.put(`/attempts/${id}/answers`, { answers: answersRef.current });
      setSaveState('Đã lưu ' + new Date().toLocaleTimeString('vi-VN'));
    } catch (e) {
      const m = errMsg(e);
      setSaveState('⚠ ' + m);
      if (/hết giờ|đã nộp/i.test(m)) nav(`/result/${id}`);
      else dirty.current = true;
    }
  }, [id, nav]);

  // Tự lưu 800ms sau lần chọn cuối
  useEffect(() => {
    if (!dirty.current) return;
    const t = window.setTimeout(save, 800);
    return () => window.clearTimeout(t);
  }, [answers, save]);

  const doSubmit = useCallback(async (auto = false) => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      await api.post(`/attempts/${id}/submit`, { answers: answersRef.current });
      toast(auto ? 'Hết giờ — bài đã được nộp tự động' : 'Đã nộp bài');
      nav(`/result/${id}`);
    } catch (e) { submitting.current = false; toast(errMsg(e), true); }
  }, [id, nav, toast]);

  // Đồng hồ
  useEffect(() => {
    if (!a) return;
    const deadline = +new Date(a.deadline_at);
    const tick = () => {
      const l = deadline - (Date.now() + offset.current);
      setLeft(l);
      if (l <= 0) doSubmit(true);
    };
    tick();
    const iv = window.setInterval(tick, 1000);
    return () => window.clearInterval(iv);
  }, [a, doSubmit]);

  // Lưu khi rời trang
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { save(); e.preventDefault(); } };
    window.addEventListener('beforeunload', h);
    return () => { window.removeEventListener('beforeunload', h); save(); };
  }, [save]);

  if (error) return <ErrorBox error={error} />;
  if (!a) return <Loading />;

  const pick = (qid: number, i: number | null) => {
    dirty.current = true;
    setAnswers((prev) => {
      const n = { ...prev };
      if (i === null) delete n[qid]; else n[qid] = i;
      return n;
    });
  };
  const answered = Object.keys(answers).length;

  const submitClick = async () => {
    const rest = a.questions.length - answered;
    if (await confirm(rest ? `Bạn còn ${rest} câu chưa trả lời. Vẫn nộp bài?` : 'Nộp bài và xem kết quả?', 'Nộp bài')) doSubmit();
  };

  return (
    <div className="take">
      <div>
        <div className="page-head"><div><h1>{a.exam.title}</h1><p>{a.questions.length} câu hỏi</p></div></div>
        <div className="stack">
          {a.questions.map((q) => (
            <div key={q.id} className="card question" id={`q${q.id}`}>
              <div className="q-head"><span className="q-no">Câu {q.no}</span><span className="small muted">{q.points} điểm</span></div>
              <QuestionBody q={q} />
              <div className="options">
                {q.options.map((o, i) => (
                  <label key={i} className={'opt' + (answers[q.id] === i ? ' sel' : '')}
                    onClick={(e) => { e.preventDefault(); pick(q.id, i); }}>
                    <span className="letter">{LETTERS[i]}</span><OptionBody o={o} />
                  </label>
                ))}
              </div>
              {answers[q.id] !== undefined && (
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                  <button className="btn sm ghost" onClick={() => pick(q.id, null)}>Bỏ chọn</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <aside className="card take-side">
        <div className="small muted" style={{ textAlign: 'center' }}>Thời gian còn lại</div>
        <div className={'timer' + (left < 60000 ? ' warn' : '')}>{fmtDuration(left)}</div>
        <div className="navgrid">
          {a.questions.map((q) => (
            <button key={q.id} className={answers[q.id] !== undefined ? 'answered' : ''}
              onClick={() => document.getElementById(`q${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{q.no}</button>
          ))}
        </div>
        <div className="small muted" style={{ textAlign: 'center', marginBottom: 10 }}>Đã trả lời {answered}/{a.questions.length}</div>
        <button className="btn primary" style={{ width: '100%' }} onClick={submitClick}>Nộp bài</button>
        <div className="save-state">{saveState}</div>
      </aside>
    </div>
  );
}
