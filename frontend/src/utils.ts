import type { GroupType, MemberStatus, Visibility } from './types';

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const VIS_LABEL: Record<Visibility, string> = { public: 'Công khai', restricted: 'Giới hạn', draft: 'Nháp' };
export const STATUS_LABEL: Record<MemberStatus, string> = { pending: 'Chờ duyệt', approved: 'Đã tham gia', rejected: 'Bị từ chối' };
export const TYPE_LABEL: Record<GroupType, string> = { class: 'Lớp học', group: 'Nhóm' };

export function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

export function scoreClass(v: number | null | undefined): string {
  if (v == null) return '';
  return v >= 8 ? 'score-hi' : v >= 5 ? 'score-mid' : 'score-lo';
}

/** ISO -> giá trị cho <input type="datetime-local"> theo giờ máy */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
