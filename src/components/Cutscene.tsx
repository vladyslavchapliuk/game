import { useEffect, useRef, useState } from 'react';
import type { OutcomeKind } from '../content/types';
import { CUTSCENES } from '../content/cutscenes';
import { storyboardSrc, iconSrc } from '../state/assets';
import { useStore } from '../state/store';
import { play } from '../state/sound';

const FRAME_MS = 1600;

/** 5 frames × 1.6 s, always skippable (Skip button, Esc, Space). Reduced motion shows the final frame. */
export function Cutscene({ kind, onDone }: { kind: OutcomeKind; onDone: () => void }) {
  const { settings, setSetting } = useStore();
  const script = CUTSCENES[kind];
  const reduced = settings.reducedMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [frame, setFrame] = useState(reduced ? 4 : 0);
  const skipRef = useRef<HTMLButtonElement>(null);
  const captions = settings.soda && script.soda ? script.soda : script.captions;

  useEffect(() => {
    skipRef.current?.focus();
    play(kind === 'perfect' || kind === 'good-enough' ? 'win' : 'lose');
  }, [kind]);
  useEffect(() => {
    if (reduced || frame >= 4) return;
    const id = window.setTimeout(() => setFrame((f) => f + 1), FRAME_MS);
    return () => window.clearTimeout(id);
  }, [frame, reduced]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' || e.key === ' ') { e.preventDefault(); onDone(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDone]);

  return (
    <div className="cutscene" role="dialog" aria-modal="true" aria-label={script.title}>
      <header>
        <h2>{script.title}</h2>
        <div className="row">
          <button className="tb small" onClick={() => setSetting('sound', !settings.sound)} aria-pressed={!settings.sound}>
            <img src={iconSrc('mute')} alt="" /> {settings.sound ? 'Mute' : 'Unmute'}
          </button>
          <button ref={skipRef} className="tb gold small" onClick={onDone}>
            <img src={iconSrc('skip')} alt="" /> {frame >= 4 ? 'Continue' : 'Skip'}
          </button>
        </div>
      </header>
      <div className="screen">
        {[0, 1, 2, 3, 4].map((i) => (
          <img key={i} className={`frame ${i === frame ? 'on' : ''}`} src={storyboardSrc(kind, i)} alt="" aria-hidden={i !== frame} />
        ))}
      </div>
      <div className="timeline" aria-hidden="true">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i <= frame ? 'on' : ''} />)}</div>
      <p className="caption plank" aria-live="polite">{captions[frame]}</p>
    </div>
  );
}
