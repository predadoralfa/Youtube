import { formatDuration } from "../helpers/study";

export function ResearchTopbar({ activeStudy, previewStudy, onClose }) {
  return (
    <div className="research-topbar">
      <div className="research-topbar-main">
        <div className="research-topbar-copy">
          <p className="research-kicker">Research</p>
          <h2>Study Tree</h2>
          <p className="research-copy">
            Each study unlocks what the character actually knows how to do with that material.
          </p>
        </div>

        <div className="research-global-progress">
          <div className="research-global-head">
            <span>
              {activeStudy
                ? `${activeStudy.name} ${activeStudy.currentLevel}/${activeStudy.maxLevel}`
                : "No active study"}
            </span>
            <strong>
              {activeStudy ? `Remaining: ${formatDuration(activeStudy.remainingMs)}` : "Idle"}
            </strong>
          </div>
          <div className="research-global-meter" aria-hidden="true">
            <span style={{ width: `${activeStudy ? activeStudy.liveProgressRatio * 100 : 0}%` }} />
          </div>
          <p className="research-global-copy">
            {previewStudy?.nextLevelDescription ??
              previewStudy?.levelDescription ??
              "Select or start a study to see what the next level unlocks."}
          </p>
        </div>
      </div>
      <button type="button" className="research-close" onClick={onClose}>
        Close
      </button>
    </div>
  );
}
