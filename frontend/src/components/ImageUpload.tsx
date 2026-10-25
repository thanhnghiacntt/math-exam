import { useRef, useState } from 'react';
import { api, errMsg } from '../api';
import { useUi } from '../ui';

const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';
const MAX_MB = 5;

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  small?: boolean;
}

/** Chọn / kéo-thả / dán (Ctrl+V) ảnh, upload lên server và trả về URL */
export function ImageUpload({ value, onChange, label = 'Thêm ảnh', small }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const { toast, zoom } = useUi();

  const upload = async (file: File | undefined | null) => {
    if (!file) return;
    if (!ACCEPT.split(',').includes(file.type)) return toast('Chỉ nhận ảnh PNG, JPG, GIF, WEBP', true);
    if (file.size > MAX_MB * 1024 * 1024) return toast(`Ảnh tối đa ${MAX_MB} MB`, true);
    setBusy(true);
    try {
      const r = await api.upload(file);
      onChange(r.url);
    } catch (e) {
      toast(errMsg(e), true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  if (value) {
    return (
      <div className={'upload-preview' + (small ? ' sm' : '')}>
        <img src={value} alt="" onClick={() => zoom(value)} style={{ cursor: 'zoom-in' }} />
        <button type="button" className="x" title="Xoá ảnh" onClick={() => onChange(null)}>✕</button>
      </div>
    );
  }

  return (
    <div className="upload">
      <div
        className={'upload-drop' + (small ? ' sm' : '') + (drag ? ' drag' : '')}
        tabIndex={0}
        role="button"
        onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files[0]); }}
        onPaste={(e) => {
          const item = [...e.clipboardData.items].find((i) => i.type.startsWith('image/'));
          if (item) { e.preventDefault(); upload(item.getAsFile()); }
        }}
        title="Bấm để chọn, kéo-thả, hoặc bấm vào rồi Ctrl+V để dán ảnh"
      >
        {busy ? <><span className="spinner" /> Đang tải lên…</> : <>🖼 {label}</>}
      </div>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => upload(e.target.files?.[0])} />
    </div>
  );
}
