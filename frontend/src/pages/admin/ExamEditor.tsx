import { memo, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, errMsg } from '../../api';
import { ImageUpload } from '../../components/ImageUpload';
import { MathText } from '../../components/MathText';
import { LETTERS, OptionBody, QuestionBody } from '../../components/shared';
import type { AdminExam, AdminGroup, AdminUser, EditQuestion, Visibility } from '../../types';
import { ErrorBox, Loading, Modal, useUi } from '../../ui';
import { fromLocalInput, toLocalInput, TYPE_LABEL, VIS_LABEL } from '../../utils';

let keySeq = 0;
const newKey = () => `k${++keySeq}`;
const blankQuestion = (): EditQuestion => ({
  key: newKey(), content: '', image_url: null, points: 1, explanation: '', explanation_image: null, correct_index: -1,
  options: [0, 1, 2, 3].map(() => ({ text: '', image: null })),
});

/* ---------- Nhập nhanh từ văn bản ---------- */
function parseQuickImport(text: string): EditQuestion[] {
  const qs: EditQuestion[] = [];
  let cur: EditQuestion | null = null;
  const push = () => { if (cur && cur.content.trim()) qs.push(cur); };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const opt = line.match(/^(\*)?\s*([A-Ha-h])[.)]\s+(.*)$/);
    const ans = line.match(/^(?:đáp án|answer)\s*[:：]\s*([A-Ha-h])\b/i);
    const exp = line.match(/^(?:giải thích|lời giải)\s*[:：]\s*(.*)$/i);
    if (opt && cur) {
      if (opt[1]) cur.correct_index = cur.options.length;
      cur.options.push({ text: opt[3], image: null });
    } else if (ans && cur) {
      cur.correct_index = ans[1].toUpperCase().charCodeAt(0) - 65;
    } else if (exp && cur) {
      cur.explanation = exp[1];
    } else if (cur && cur.options.length === 0) {
      cur.content += '\n' + line;
    } else {
      push();
      cur = { ...blankQuestion(), options: [], content: line.replace(/^(câu|question)\s*\d+\s*[:.)]\s*/i, '') };
    }
  }
  push();
  return qs;
}

function ImportModal({ onImport, onClose }: { onImport: (qs: EditQuestion[], replace: boolean) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(false);
  const { toast } = useUi();
  return (
    <Modal onClose={onClose} wide>
      <h2>Nhập nhanh câu hỏi</h2>
      <p className="small muted">Mỗi câu gồm nội dung, các phương án <code>A.</code> <code>B.</code>…; đánh dấu đáp án bằng <code>*</code> trước chữ cái hoặc dòng <code>Đáp án: B</code>. Có thể thêm <code>Lời giải: …</code>. Ảnh thêm sau khi nhập.</p>
      <textarea rows={12} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Câu 1: Nghiệm của $x^2 = 4$ là:\nA. $x = 2$\nB. $x = -2$\n*C. $x = \\pm 2$\nD. Vô nghiệm\nLời giải: $x = \\pm 2$\n\nCâu 2: $2 + 2 = ?$\nA. 3\nB. 4\nĐáp án: B'} />
      <label className="check" style={{ marginTop: 8 }}><input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} /> Thay thế toàn bộ câu hỏi hiện có</label>
      <div className="modal-actions">
        <button className="btn" onClick={onClose}>Huỷ</button>
        <button className="btn primary" onClick={() => {
          const qs = parseQuickImport(text);
          if (!qs.length) return toast('Không đọc được câu hỏi nào', true);
          onImport(qs, replace);
          onClose();
        }}>Nhập</button>
      </div>
    </Modal>
  );
}

/* ---------- Soạn 1 câu hỏi ---------- */
const QuestionEditor = memo(function QuestionEditor({ q, index, total, onChange, onMove, onDuplicate, onRemove }: {
  q: EditQuestion; index: number; total: number;
  onChange: (key: string, patch: Partial<EditQuestion>) => void;
  onMove: (key: string, dir: -1 | 1) => void;
  onDuplicate: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  const set = (patch: Partial<EditQuestion>) => onChange(q.key, patch);
  const setOpt = (k: number, patch: Partial<EditQuestion['options'][number]>) =>
    set({ options: q.options.map((o, i) => (i === k ? { ...o, ...patch } : o)) });
  const removeOpt = (k: number) => set({
    options: q.options.filter((_, i) => i !== k),
    correct_index: q.correct_index === k ? -1 : q.correct_index > k ? q.correct_index - 1 : q.correct_index,
  });
  const [preview, setPreview] = useState(false);
  const hasMath = /\$|\\\(|\\\[/.test(q.content + q.explanation + q.options.map((o) => o.text).join(''));

  return (
    <div className="q-edit">
      <div className="head">
        <strong>Câu {index + 1}</strong><span className="grow" />
        <label className="small" style={{ margin: 0 }}>Điểm</label>
        <input type="number" step="0.25" min="0" value={q.points} style={{ width: 80 }} onChange={(e) => set({ points: Number(e.target.value) })} />
        <button className="btn sm ghost" disabled={index === 0} title="Lên" onClick={() => onMove(q.key, -1)}>↑</button>
        <button className="btn sm ghost" disabled={index === total - 1} title="Xuống" onClick={() => onMove(q.key, 1)}>↓</button>
        <button className="btn sm ghost" title="Nhân bản" onClick={() => onDuplicate(q.key)}>⧉</button>
        <button className="btn sm danger" title="Xoá" onClick={() => onRemove(q.key)}>✕</button>
      </div>

      <div className="field">
        <textarea rows={2} value={q.content} onChange={(e) => set({ content: e.target.value })}
          placeholder={q.image_url ? 'Nội dung bổ sung (không bắt buộc khi đã có ảnh đề)' : 'Nội dung câu hỏi… ví dụ: Tính $\\lim_{x\\to 0} \\frac{\\sin x}{x}$'} />
        <div style={{ marginTop: 8 }}>
          <ImageUpload value={q.image_url} onChange={(url) => set({ image_url: url })} label="Ảnh đề bài (thay cho / bổ sung nội dung)" />
        </div>
      </div>

      {q.options.map((o, k) => (
        <div key={k} className="opt-edit">
          <input type="radio" name={`c-${q.key}`} checked={q.correct_index === k} onChange={() => set({ correct_index: k })} title="Đáp án đúng" />
          <span className="l">{LETTERS[k]}</span>
          <div className="opt-main">
            <input value={o.text} placeholder={o.image ? 'Chú thích (không bắt buộc)' : `Phương án ${LETTERS[k]}`} onChange={(e) => setOpt(k, { text: e.target.value })} />
            <ImageUpload small value={o.image} onChange={(url) => setOpt(k, { image: url })} label="Ảnh" />
          </div>
          <button className="btn sm ghost" disabled={q.options.length <= 2} onClick={() => removeOpt(k)}>✕</button>
        </div>
      ))}
      <div className="row" style={{ margin: '4px 0 10px' }}>
        <button className="btn sm" disabled={q.options.length >= 8} onClick={() => set({ options: [...q.options, { text: '', image: null }] })}>+ Phương án</button>
        <span className="hint" style={{ margin: 0 }}>Chọn ô tròn bên trái để đánh dấu đáp án đúng.</span>
      </div>

      <textarea rows={1} value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} placeholder="Lời giải (không bắt buộc)" />
      <div style={{ marginTop: 6 }}><ImageUpload small value={q.explanation_image} onChange={(url) => set({ explanation_image: url })} label="Ảnh lời giải" /></div>

      {(hasMath || q.image_url || q.options.some((o) => o.image)) && (
        <div style={{ marginTop: 10 }}>
          <button className="btn sm ghost" onClick={() => setPreview((p) => !p)}>{preview ? '▾ Ẩn xem trước' : '▸ Xem trước như học sinh thấy'}</button>
          {preview && (
            <div className="preview">
              <QuestionBody q={q} />
              <div className="options">
                {q.options.map((o, i) => (o.text || o.image) && (
                  <div key={i} className={'opt' + (i === q.correct_index ? ' right' : '')}><span className="letter">{LETTERS[i]}</span><OptionBody o={o} /></div>
                ))}
              </div>
              {q.explanation && <div className="explain"><strong>Lời giải: </strong><MathText text={q.explanation} /></div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/* ---------- Trang soạn đề ---------- */
interface Meta {
  title: string; description: string; duration_minutes: number; max_attempts: number;
  shuffle: boolean; show_answers: boolean; start_at: string; end_at: string; visibility: Visibility;
  group_ids: number[]; user_ids: number[];
}

export function ExamEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const { toast, confirm } = useUi();
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [questions, setQuestions] = useState<EditQuestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [userFilter, setUserFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    Promise.all([
      api.get<AdminGroup[]>('/admin/groups'), api.get<AdminUser[]>('/admin/users'),
      id ? api.get<AdminExam>(`/admin/exams/${id}`) : Promise.resolve(null),
    ]).then(([g, u, e]) => {
      setGroups(g); setUsers(u);
      if (e) {
        setMeta({
          title: e.title, description: e.description, duration_minutes: e.duration_minutes, max_attempts: e.max_attempts,
          shuffle: e.shuffle, show_answers: e.show_answers, start_at: toLocalInput(e.start_at), end_at: toLocalInput(e.end_at),
          visibility: e.visibility, group_ids: e.group_ids, user_ids: e.users.map((x) => x.id),
        });
        setQuestions(e.questions.map((q) => ({ ...q, key: newKey() })));
      } else {
        setMeta({ title: '', description: '', duration_minutes: 30, max_attempts: 0, shuffle: false, show_answers: true,
          start_at: '', end_at: '', visibility: 'draft', group_ids: [], user_ids: [] });
        setQuestions([blankQuestion()]);
      }
    }).catch((e) => setError(e.message));
  }, [id]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  if (error) return <ErrorBox error={error} />;
  if (!meta) return <Loading />;

  const setM = (patch: Partial<Meta>) => { dirty.current = true; setMeta({ ...meta, ...patch }); };
  const editQ = (fn: (qs: EditQuestion[]) => EditQuestion[]) => { dirty.current = true; setQuestions(fn); };
  const onChange = (key: string, patch: Partial<EditQuestion>) => editQ((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const onMove = (key: string, dir: -1 | 1) => editQ((qs) => {
    const i = qs.findIndex((q) => q.key === key), j = i + dir;
    if (j < 0 || j >= qs.length) return qs;
    const n = [...qs]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const onDuplicate = (key: string) => editQ((qs) => {
    const i = qs.findIndex((q) => q.key === key);
    const n = [...qs];
    n.splice(i + 1, 0, { ...qs[i], id: undefined, key: newKey(), options: qs[i].options.map((o) => ({ ...o })) });
    return n;
  });
  const onRemove = (key: string) => editQ((qs) => qs.filter((q) => q.key !== key));
  const toggleIn = (arr: number[], v: number) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const totalPoints = Math.round(questions.reduce((s, q) => s + (Number(q.points) || 0), 0) * 100) / 100;

  const save = async () => {
    // Bỏ câu trống hoàn toàn, bỏ phương án trống nhưng giữ đúng chỉ số đáp án
    const qs = questions
      .filter((q) => q.content.trim() || q.image_url || q.options.some((o) => o.text.trim() || o.image))
      .map((q) => {
        const keep = q.options.map((o, k) => ({ o: { text: o.text.trim(), image: o.image }, k })).filter((x) => x.o.text || x.o.image);
        return { id: q.id, content: q.content, image_url: q.image_url, points: q.points, explanation: q.explanation,
          explanation_image: q.explanation_image, options: keep.map((x) => x.o), correct_index: keep.findIndex((x) => x.k === q.correct_index) };
      });
    if (meta.visibility === 'restricted' && !meta.group_ids.length && !meta.user_ids.length
      && !(await confirm('Đề ở chế độ "Giới hạn" nhưng chưa giao cho nhóm hay user nào — sẽ không ai thấy. Vẫn lưu?', 'Vẫn lưu'))) return;
    setSaving(true);
    try {
      const body = { ...meta, start_at: fromLocalInput(meta.start_at), end_at: fromLocalInput(meta.end_at), questions: qs };
      if (id) {
        await api.put(`/admin/exams/${id}`, body);
        const fresh = await api.get<AdminExam>(`/admin/exams/${id}`);
        setQuestions(fresh.questions.map((q) => ({ ...q, key: newKey() })));
      } else {
        const r = await api.post<{ id: number }>('/admin/exams', body);
        dirty.current = false;
        nav(`/admin/exams/${r.id}/edit`, { replace: true });
      }
      dirty.current = false;
      toast('Đã lưu đề thi');
    } catch (e) { toast(errMsg(e), true); } finally { setSaving(false); }
  };

  const del = async () => {
    if (!(await confirm('Xoá đề thi này cùng toàn bộ kết quả làm bài?', 'Xoá', true))) return;
    await api.del(`/admin/exams/${id}`);
    dirty.current = false;
    toast('Đã xoá');
    nav('/admin/exams');
  };

  const uf = userFilter.trim().toLowerCase();
  const visDesc: Record<Visibility, string> = { draft: 'Chưa đăng, user không thấy', public: 'Mọi user đều thấy và làm được', restricted: 'Chỉ nhóm/lớp và user được chọn' };

  return (
    <>
      <p><Link to="/admin/exams">← Đề thi</Link></p>
      <div className="page-head">
        <div><h1>{id ? 'Sửa đề thi' : 'Tạo đề thi'}</h1>
          <p>Công thức viết bằng LaTeX trong <code>$...$</code> (ví dụ <code>{'$\\frac{a}{b}$'}</code>, <code>$x^2$</code>). Có thể dùng <strong>ảnh</strong> thay cho nội dung đề — bấm chọn, kéo-thả hoặc dán (Ctrl+V) ảnh chụp.</p></div>
        {id && <button className="btn danger" onClick={del}>Xoá đề</button>}
      </div>

      <div className="card"><h3>Thông tin chung</h3>
        <div className="field"><label>Tiêu đề</label><input value={meta.title} onChange={(e) => setM({ title: e.target.value })} /></div>
        <div className="field"><label>Mô tả / hướng dẫn</label><textarea value={meta.description} onChange={(e) => setM({ description: e.target.value })} /></div>
        <div className="fields-3">
          <div className="field"><label>Thời gian (phút)</label><input type="number" min={1} max={600} value={meta.duration_minutes} onChange={(e) => setM({ duration_minutes: Number(e.target.value) })} /></div>
          <div className="field"><label>Số lượt tối đa (0 = không giới hạn)</label><input type="number" min={0} value={meta.max_attempts} onChange={(e) => setM({ max_attempts: Number(e.target.value) })} /></div>
          <div className="field"><label>&nbsp;</label>
            <label className="check"><input type="checkbox" checked={meta.shuffle} onChange={(e) => setM({ shuffle: e.target.checked })} /> Xáo trộn thứ tự câu</label>
            <label className="check"><input type="checkbox" checked={meta.show_answers} onChange={(e) => setM({ show_answers: e.target.checked })} /> Cho xem đáp án sau khi nộp</label>
          </div>
        </div>
        <div className="fields-2">
          <div className="field"><label>Mở lúc (không bắt buộc)</label><input type="datetime-local" value={meta.start_at} onChange={(e) => setM({ start_at: e.target.value })} /></div>
          <div className="field"><label>Đóng lúc (không bắt buộc)</label><input type="datetime-local" value={meta.end_at} onChange={(e) => setM({ end_at: e.target.value })} /></div>
        </div>
      </div>

      <div className="card"><h3>Đăng bài & phân quyền</h3>
        <div className="fields-3" style={{ marginBottom: 6 }}>
          {(['draft', 'public', 'restricted'] as Visibility[]).map((v) => (
            <label key={v} className="check card" style={{ padding: 12, margin: 0 }}>
              <input type="radio" name="vis" checked={meta.visibility === v} onChange={() => setM({ visibility: v })} />
              <span><strong>{VIS_LABEL[v]}</strong><div className="small muted">{visDesc[v]}</div></span>
            </label>
          ))}
        </div>
        {meta.visibility === 'restricted' && (
          <div className="fields-2" style={{ marginTop: 14 }}>
            <div className="field"><label>Giao cho nhóm / lớp</label>
              <div className="picker">{groups.length ? groups.map((g) => (
                <label key={g.id} className="check"><input type="checkbox" className="pick-g" checked={meta.group_ids.includes(g.id)} onChange={() => setM({ group_ids: toggleIn(meta.group_ids, g.id) })} />
                  <span className={'tag ' + g.type}>{TYPE_LABEL[g.type]}</span> {g.name} <span className="small muted">({g.member_count})</span></label>
              )) : <p className="small muted">Chưa có nhóm. <Link to="/admin/groups">Tạo nhóm</Link></p>}</div>
            </div>
            <div className="field"><label>Giao cho user cụ thể</label>
              <input placeholder="Lọc user…" style={{ marginBottom: 6 }} value={userFilter} onChange={(e) => setUserFilter(e.target.value)} />
              <div className="picker">{users.filter((u) => u.role === 'user' && (!uf || (u.username + ' ' + u.full_name).toLowerCase().includes(uf))).map((u) => (
                <label key={u.id} className="check"><input type="checkbox" checked={meta.user_ids.includes(u.id)} onChange={() => setM({ user_ids: toggleIn(meta.user_ids, u.id) })} />
                  {u.full_name} <span className="small muted">@{u.username}</span></label>
              ))}</div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Câu hỏi ({questions.length}) · Tổng {totalPoints} điểm</h3>
          <div className="row">
            <button className="btn" onClick={() => setImporting(true)}>Nhập nhanh từ văn bản</button>
            <button className="btn primary" onClick={() => editQ((qs) => [...qs, blankQuestion()])}>+ Thêm câu</button>
          </div>
        </div>
        {questions.length ? questions.map((q, i) => (
          <QuestionEditor key={q.key} q={q} index={i} total={questions.length}
            onChange={onChange} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} />
        )) : <div className="empty">Chưa có câu hỏi.</div>}
        <div className="sticky-actions">
          <Link className="btn" to="/admin/exams">Huỷ</Link>
          <button className="btn primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu đề thi'}</button>
        </div>
      </div>

      {importing && <ImportModal onClose={() => setImporting(false)} onImport={(parsed, replace) => {
        const blank = questions.length === 1 && !questions[0].content.trim() && !questions[0].image_url;
        editQ((qs) => (replace || blank ? parsed : [...qs, ...parsed]));
        const missing = parsed.filter((q) => q.correct_index < 0 || q.correct_index >= q.options.length).length;
        toast(`Đã nhập ${parsed.length} câu` + (missing ? ` — ${missing} câu chưa có đáp án đúng` : ''), missing > 0);
      }} />}
    </>
  );
}
