import katex from 'katex';
import { Fragment, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import { useStore } from '../state/store';
import { sodaText } from '../state/assets';

/**
 * KaTeX formula. Display formulas shrink to fit their box (down to 60%) instead
 * of being cut off or overlapping neighbours; if still too wide they scroll.
 */
export function Tex({ tex, display = false, fit = display }: { tex: string; display?: boolean; fit?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore' }),
    [tex, display],
  );
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!fit || !el) return;
    const apply = () => {
      el.style.fontSize = '';
      const inner = el.querySelector('.katex-html') as HTMLElement | null;
      if (!inner) return;
      const need = inner.scrollWidth;
      const have = el.clientWidth;
      if (need > have + 1 && have > 0) el.style.fontSize = `${Math.max(0.6, (have - 2) / need)}em`;
    };
    apply();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    ro?.observe(el.parentElement ?? el);
    // KaTeX's fonts can arrive after the first measurement; widths change then.
    const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
    let alive = true;
    fonts?.ready.then(() => alive && apply());
    fonts?.addEventListener?.('loadingdone', apply);
    return () => { alive = false; ro?.disconnect(); fonts?.removeEventListener?.('loadingdone', apply); };
  }, [html, fit]);
  return <span ref={ref} className={display ? 'tex-block' : 'tex-inline'} dangerouslySetInnerHTML={{ __html: html }} />;
}

// Inline markup: **bold**, *italic*, $tex$. Punctuation touching a formula
// (e.g. "($x$)." ) is kept on the same line as the formula so it never dangles.
type Seg = { t: 'text' | 'tex' | 'b' | 'i'; s: string };
const PRE = /[(\[{„“"']+$/;
const POST = /^[)\]}.,;:!?%”"']+/;
const inline = (text: string, key: string): ReactNode[] => {
  const segs: Seg[] = [];
  const re = /(\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) segs.push({ t: 'text', s: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('$')) segs.push({ t: 'tex', s: tok.slice(1, -1) });
    else if (tok.startsWith('**')) segs.push({ t: 'b', s: tok.slice(2, -2) });
    else segs.push({ t: 'i', s: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < text.length) segs.push({ t: 'text', s: text.slice(last) });

  const out: ReactNode[] = [];
  segs.forEach((seg, i) => {
    const k = `${key}-${i}`;
    if (seg.t === 'text') { if (seg.s) out.push(seg.s); return; }
    if (seg.t === 'b') { out.push(<b key={k}>{inline(seg.s, k)}</b>); return; }
    if (seg.t === 'i') { out.push(<em key={k}>{inline(seg.s, k)}</em>); return; }
    let pre = '';
    let post = '';
    const prev = segs[i - 1];
    const next = segs[i + 1];
    if (prev?.t === 'text') {
      const pm = prev.s.match(PRE);
      if (pm) { pre = pm[0]; prev.s = prev.s.slice(0, -pre.length); if (typeof out[out.length - 1] === 'string') out[out.length - 1] = prev.s; }
    }
    if (next?.t === 'text') {
      const nm = next.s.match(POST);
      if (nm) { post = nm[0]; next.s = next.s.slice(post.length); }
    }
    const tex = <Tex key={pre || post ? undefined : k} tex={seg.s} />;
    out.push(pre || post ? <span key={k} className="nobr">{pre}{tex}{post}</span> : tex);
  });
  return out.filter((n) => n !== '');
};

/** Paragraphs split on blank lines. Applies soda-mode wording. */
export function Rich({ text, as = 'p' }: { text: string; as?: 'p' | 'span' }) {
  const { settings } = useStore();
  const t = sodaText(text, settings.soda);
  if (as === 'span') return <>{inline(t, 's')}</>;
  return (
    <>
      {t.split(/\n\n+/).map((para, i) => (
        <Fragment key={i}>
          <p>{inline(para, `p${i}`)}</p>
        </Fragment>
      ))}
    </>
  );
}

export function Stars({ n, of = 3, label = true }: { n: number; of?: number; label?: boolean }) {
  return (
    <span className="stars" aria-label={label ? `${n} of ${of} stars` : undefined} role={label ? 'img' : undefined}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < n ? '' : 'off'} aria-hidden="true">★</span>
      ))}
    </span>
  );
}
