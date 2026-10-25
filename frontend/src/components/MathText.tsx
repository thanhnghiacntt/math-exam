import katex from 'katex';
import 'katex/dist/katex.min.css';
import { memo, useMemo } from 'react';

type Seg = { t: 'text' | 'inline' | 'display'; v: string };

/** Tách chuỗi thành đoạn văn bản và công thức: $$..$$, \[..\], $..$, \(..\) */
function split(src: string): Seg[] {
  const out: Seg[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$((?:\\\$|[^$])+?)\$|\\\(([\s\S]+?)\\\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ t: 'text', v: src.slice(last, m.index) });
    if (m[1] ?? m[2]) out.push({ t: 'display', v: (m[1] ?? m[2])! });
    else out.push({ t: 'inline', v: (m[3] ?? m[4])! });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ t: 'text', v: src.slice(last) });
  return out;
}

/** Hiển thị văn bản có công thức LaTeX. Văn bản thường được React escape, công thức render bằng KaTeX. */
export const MathText = memo(function MathText({ text, className, block }: { text: string; className?: string; block?: boolean }) {
  const parts = useMemo(() => split(text || ''), [text]);
  const Tag = block ? 'div' : 'span';
  return (
    <Tag className={className} style={block ? { whiteSpace: 'pre-wrap' } : undefined}>
      {parts.map((p, i) => {
        if (p.t === 'text') return <span key={i}>{p.v}</span>;
        const html = katex.renderToString(p.v, { displayMode: p.t === 'display', throwOnError: false, strict: 'ignore', trust: false });
        return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
      })}
    </Tag>
  );
});
