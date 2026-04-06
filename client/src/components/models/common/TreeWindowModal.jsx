import "@/style/researchModal.css";

function TreeCard({ node }) {
  const tone = String(node?.tone ?? "stone");
  const title = node?.title ?? "Untitled";
  const description = node?.description ?? "";
  const badge = node?.badge ?? "Preview";
  const metaLeft = node?.metaLeft ?? "";
  const metaRight = node?.metaRight ?? "";
  const actionLabel = node?.actionLabel ?? "Coming Soon";
  const actionDisabled = node?.actionDisabled !== false;
  const iconLabel = node?.iconLabel ?? "•";

  return (
    <div className="research-row">
      <article className={`research-card research-card--${tone}`}>
        <div className="research-card-head">
          <div className="research-icon-box">
            <span className="research-fallback-icon" aria-hidden="true">
              {iconLabel}
            </span>
          </div>
          <div className="research-head-copy">
            <span className="research-badge">{badge}</span>
            <h3>{title}</h3>
          </div>
        </div>

        <p>{description}</p>

        {(metaLeft || metaRight) ? (
          <div className="research-meta">
            <span>{metaLeft}</span>
            <span>{metaRight}</span>
          </div>
        ) : null}

        <button type="button" className="research-action" disabled={actionDisabled}>
          {actionLabel}
        </button>
      </article>

      <div className="research-connector" aria-hidden="true">
        <span className="research-line" />
        <span className="research-dot" />
        <span className="research-placeholder">
          Next step
          <small>future branch</small>
        </span>
      </div>
    </div>
  );
}

export function TreeWindowModal({
  open,
  kicker,
  title,
  copy,
  footerLeft,
  footerRight = "Close: Esc",
  nodes = [],
  onClose,
}) {
  if (!open) return null;

  return (
    <div
      className="research-overlay"
      data-ui-block-game-input="true"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="research-modal" onContextMenu={(e) => e.preventDefault()}>
        <div className="research-shell">
          <div className="research-topbar">
            <div className="research-topbar-main">
              <div className="research-topbar-copy">
                <p className="research-kicker">{kicker}</p>
                <h2>{title}</h2>
                <p className="research-copy">{copy}</p>
              </div>
            </div>
            <button type="button" className="research-close" onClick={onClose}>
              Close
            </button>
          </div>

          <div className="research-board">
            <div className="research-content" style={{ minHeight: "100%" }}>
              <div className="research-lane research-lane--static">
                {nodes.map((node, index) => (
                  <TreeCard key={node?.id ?? `${title}-${index}`} node={node} />
                ))}
              </div>
            </div>
          </div>

          <div className="research-footer">
            <span>{footerLeft}</span>
            <span>{footerRight}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
