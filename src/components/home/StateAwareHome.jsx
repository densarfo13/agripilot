/**
 * StateAwareHome — renders a Home payload produced by
 * buildHomeExperience(). It's deliberately thin: the logic has
 * already happened upstream, so this is just layout.
 *
 *   <StateAwareHome
 *     homeExperience={home}          // output of buildHomeExperience
 *     onCtaClick={() => ...}
 *     renderTaskCard={(taskId) => <YourExistingTaskCard id={taskId} />}
 *   />
 *
 * Visual rules:
 *   • STATE-FIRST: title banner on top, task card below, CTA button
 *   • TASK-FIRST: task card on top, state "why" shown as a small line
 *                 above it, next-step bridge shown below
 *   • stale offline: a muted "Based on your last update" prefix line
 *                    above the title
 */

export default function StateAwareHome({
  homeExperience = null,
  onCtaClick = null,
  renderTaskCard = null,
  className = '',
}) {
  if (!homeExperience) return null;
  const h = homeExperience;
  const mode = h.displayMode || 'state_first';

  const confidencePrefix = h.confidenceLine ? (
    <p className="state-aware-home__confidence"
       style={{ margin: '0 0 6px', fontSize: 12, color: '#777', fontStyle: 'italic' }}>
      {h.confidenceLine}
    </p>
  ) : null;

  const titleEl = (
    <h2 className="state-aware-home__title"
        style={{ margin: 0, fontSize: 20, fontWeight: 700, lineHeight: 1.25 }}>
      {h.title}
    </h2>
  );

  const subtitleEl = h.subtitle ? (
    <p className="state-aware-home__subtitle"
       style={{ margin: '4px 0 0', fontSize: 14, color: '#444' }}>
      {h.subtitle}
    </p>
  ) : null;

  const whyEl = h.why ? (
    <p className="state-aware-home__why"
       style={{ margin: '6px 0 0', fontSize: 13, color: '#555' }}>
      {h.why}
    </p>
  ) : null;

  const nextEl = h.next ? (
    <p className="state-aware-home__next"
       style={{ margin: '10px 0 0', fontSize: 14, color: '#1b5e20', fontWeight: 600 }}>
      → {h.next}
    </p>
  ) : null;

  const ctaEl = h.cta ? (
    <button type="button"
            className="state-aware-home__cta"
            onClick={onCtaClick}
            style={{
              marginTop: 12,
              padding: '10px 16px',
              borderRadius: 8,
              border: '1px solid #1b5e20',
              background: '#1b5e20',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}>
      {h.cta}
    </button>
  ) : null;

  const taskEl = h.taskId && typeof renderTaskCard === 'function'
    ? renderTaskCard(h.taskId)
    : null;

  if (mode === 'task_first') {
    return (
      <section
        className={`state-aware-home state-aware-home--task-first ${className}`.trim()}
        data-display-mode="task_first"
        data-state={h.state}
        data-level={h.level}
      >
        {confidencePrefix}
        {whyEl}
        {taskEl}
        {nextEl}
      </section>
    );
  }

  // state-first
  return (
    <section
      className={`state-aware-home state-aware-home--state-first ${className}`.trim()}
      data-display-mode="state_first"
      data-state={h.state}
      data-level={h.level}
    >
      {confidencePrefix}
      {titleEl}
      {subtitleEl}
      {whyEl}
      {taskEl}
      {nextEl}
      {ctaEl}
    </section>
  );
}
