import "@/style/researchModal.css";
import { useTreeBoardPanZoom } from "@/components/models/common/treeBoardPanZoom";

const BUILD_NODES = [
  {
    id: "build-core",
    tone: "build",
    iconLabel: "B",
    badge: "Build",
    title: "Primitive Shelter",
    description: "Mark a ground spot for the first sleeping place and survival base.",
    metaLeft: "Branch: Shelter",
    metaRight: "Tier 0",
    actionLabel: "Place",
    actionDisabled: false,
  },
];

function BuildCard({ node, onPlaceShelter }) {
  const tone = String(node?.tone ?? "build");
  const title = node?.title ?? "Untitled";
  const description = node?.description ?? "";
  const badge = node?.badge ?? "Preview";
  const metaLeft = node?.metaLeft ?? "";
  const metaRight = node?.metaRight ?? "";
  const actionLabel = node?.actionLabel ?? "Coming Soon";
  const actionDisabled = node?.actionDisabled !== false;
  const iconLabel = node?.iconLabel ?? "B";

  return (
    <article className={`research-card research-card--${tone} build-card`}>
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

      <button
        type="button"
        className="research-action"
        disabled={actionDisabled}
        onClick={() => {
          if (actionDisabled) return;
          onPlaceShelter?.();
        }}
      >
        {actionLabel}
      </button>
    </article>
  );
}

function BuildBoard({ boardRef, laneRef, zoom, contentSize, onWheel, onMouseDown, onPlaceShelter }) {
  return (
    <div
      ref={boardRef}
      className="research-board"
      onContextMenu={(e) => e.preventDefault()}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
    >
      <div className="research-pan-hint">Right click + drag to navigate the tree | Scroll to zoom</div>
      <div
        className="research-content"
        style={{
          width: `${contentSize.width * zoom}px`,
          height: `${contentSize.height * zoom}px`,
        }}
      >
        <div
          ref={laneRef}
          className="build-stage"
          style={{
            width: "1600px",
            height: "980px",
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
          }}
        >
          <div className="build-stage-column">
            {BUILD_NODES.map((node) => (
              <BuildCard key={node.id} node={node} onPlaceShelter={onPlaceShelter} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BuildModal({ open, onClose, onPlaceShelter }) {
  const board = useTreeBoardPanZoom({ open, contentWidth: 1600, contentHeight: 980 });

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
                <p className="research-kicker">Build</p>
                <h2>Builder Tree</h2>
                <p className="research-copy">
                  A simple planning screen for future placement and survival construction.
                </p>
              </div>
            </div>
            <button type="button" className="research-close" onClick={onClose}>
              Close
            </button>
          </div>

          <BuildBoard
            boardRef={board.boardRef}
            laneRef={board.laneRef}
            zoom={board.zoom}
            contentSize={board.contentSize}
            onWheel={board.handleBoardWheel}
            onMouseDown={board.handleBoardMouseDown}
            onPlaceShelter={onPlaceShelter}
          />

          <div className="research-footer">
            <span>Shortcut: B</span>
            <span>Close: Esc</span>
          </div>
        </div>
      </div>
    </div>
  );
}
