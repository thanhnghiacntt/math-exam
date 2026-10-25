import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

/* ---------------- Toast + Confirm + Lightbox ---------------- */
interface UiCtx {
  toast: (msg: string, isErr?: boolean) => void;
  confirm: (msg: string, okText?: string, danger?: boolean) => Promise<boolean>;
  zoom: (src: string) => void;
}
const Ctx = createContext<UiCtx>(null as unknown as UiCtx);
export const useUi = () => useContext(Ctx);

interface ConfirmState { msg: string; okText: string; danger: boolean; resolve: (v: boolean) => void }

export function UiProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; err: boolean } | null>(null);
  const [cf, setCf] = useState<ConfirmState | null>(null);
  const [img, setImg] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const toast = useCallback((msg: string, err = false) => {
    setT({ msg, err });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), 3200);
  }, []);

  const confirm = useCallback((msg: string, okText = 'Đồng ý', danger = false) =>
    new Promise<boolean>((resolve) => setCf({ msg, okText, danger, resolve })), []);

  const close = (v: boolean) => { cf?.resolve(v); setCf(null); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setImg(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Ctx.Provider value={{ toast, confirm, zoom: setImg }}>
      {children}
      {t && <div className={'toast' + (t.err ? ' err' : '')}>{t.msg}</div>}
      {cf && (
        <Modal onClose={() => close(false)}>
          <h2>Xác nhận</h2>
          <p>{cf.msg}</p>
          <div className="modal-actions">
            <button className="btn" onClick={() => close(false)}>Huỷ</button>
            <button className={'btn ' + (cf.danger ? 'danger' : 'primary')} onClick={() => close(true)} autoFocus>{cf.okText}</button>
          </div>
        </Modal>
      )}
      {img && <div className="lightbox" onClick={() => setImg(null)}><img src={img} alt="" /></div>}
    </Ctx.Provider>
  );
}

export function Modal({ children, onClose, wide }: { children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={wide ? { maxWidth: 680 } : undefined}>{children}</div>
    </div>
  );
}

export function Loading() {
  return <div className="empty">Đang tải…</div>;
}

export function ErrorBox({ error }: { error: string }) {
  return <div className="card empty">⚠️ {error}</div>;
}

/** Hook tải dữ liệu đơn giản */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    setError(null);
    fn().then((d) => alive && setData(d)).catch((e) => alive && setError(e.message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((x) => x + 1), []);
  return { data, error, reload, setData };
}
