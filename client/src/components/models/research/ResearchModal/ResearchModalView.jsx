import "@/style/researchModal.css";
import { useResearchModalState } from "./hooks/useResearchModalState";
import { ResearchTopbar } from "./components/ResearchTopbar";
import { ResearchBoard } from "./components/ResearchBoard";

export function ResearchModal(props) {
  const state = useResearchModalState(props);
  if (!props.open) return null;

  return (
    <div
      className="research-overlay"
      data-ui-block-game-input="true"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="research-modal" onContextMenu={(e) => e.preventDefault()}>
        <div className="research-shell">
          <ResearchTopbar
            activeStudy={state.activeStudy}
            previewStudy={state.previewStudy}
            onClose={props.onClose}
          />

          <ResearchBoard
            boardRef={state.boardRef}
            laneRef={state.laneRef}
            zoom={state.zoom}
            contentSize={state.contentSize}
            nodes={state.nodes}
            inventoryIndex={state.inventoryIndex}
            onStartStudy={props.onStartStudy}
            onWheel={state.handleBoardWheel}
            onMouseDown={state.handleBoardMouseDown}
          />

          <div className="research-footer">
            <span>{props.researchMessage || "Shortcut: R"}</span>
            <span>Close: Esc</span>
          </div>
        </div>
      </div>
    </div>
  );
}
