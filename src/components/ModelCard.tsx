import type { Model, Sym } from '../content/models';
import { Rich, Tex } from './Rich';

function Group({ title, items }: { title: string; items: Sym[] }) {
  return (
    <div className="notation-group">
      <h4>{title}</h4>
      <dl>
        {items.map((s) => (
          <div key={s.tex} style={{ display: 'contents' }}>
            <dt><Tex tex={s.tex} /></dt>
            <dd><Rich text={s.text} as="span" />{s.example && <><br /><em>e.g. <Rich text={s.example} as="span" /></em></>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** A lecture model laid out like the slides: indices, parameters, variables, objective, constraints. */
export function ModelCard({ model, compact = false }: { model: Model; compact?: boolean }) {
  return (
    <div className="card model-card">
      <div>
        <div className="card-label">{model.lecture}</div>
        <h3>{model.title}</h3>
      </div>
      {!compact && (
        <div className="notation">
          <Group title="Indices" items={model.indices} />
          <Group title="Parameters" items={model.params} />
          <Group title="Decision variables" items={model.vars} />
        </div>
      )}
      <div>
        <div className="model-head">Objective function</div>
        <div className="model-lines">
          <div className="model-line"><Tex tex={model.objective.tex} display />{model.objective.why && <span className="why"><Rich text={model.objective.why} as="span" /></span>}</div>
        </div>
      </div>
      <div>
        <div className="model-head">Constraints</div>
        <div className="model-lines">
          {model.constraints.map((c) => (
            <div key={c.tex} className="model-line"><Tex tex={c.tex} display />{c.why && <span className="why"><Rich text={c.why} as="span" /></span>}</div>
          ))}
        </div>
      </div>
      {model.note && <p className="muted"><Rich text={model.note} as="span" /></p>}
    </div>
  );
}
