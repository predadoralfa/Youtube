import { createTreeBoardPanZoomInteractions } from "@/components/models/common/treeBoardPanZoom";

export function createResearchBoardInteractions({
  boardRef,
  dragStateRef,
  zoomRef,
  targetZoomRef,
  zoomFrameRef,
  setZoom,
}) {
  return createTreeBoardPanZoomInteractions({
    boardRef,
    dragStateRef,
    zoomRef,
    targetZoomRef,
    zoomFrameRef,
    setZoom,
  });
}
