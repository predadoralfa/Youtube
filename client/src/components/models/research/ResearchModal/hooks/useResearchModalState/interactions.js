import { clamp } from "../../helpers/study";
import { MAX_ZOOM, MIN_ZOOM } from "../../constants";

export function createResearchBoardInteractions({
  boardRef,
  dragStateRef,
  zoomRef,
  targetZoomRef,
  zoomFrameRef,
  setZoom,
}) {
  const handleBoardWheel = (e) => {
    const board = boardRef.current;
    if (!board) return;
    e.preventDefault();
    e.stopPropagation();

    const prevZoom = zoomRef.current;
    const prevTargetZoom = targetZoomRef.current;
    const factor = Math.exp(-e.deltaY * 0.00045);
    const nextTargetZoom = clamp(prevTargetZoom * factor, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(nextTargetZoom - prevTargetZoom) < 0.0001) return;

    const rect = board.getBoundingClientRect();
    const pointerX = e.clientX - rect.left;
    const pointerY = e.clientY - rect.top;
    const worldX = (board.scrollLeft + pointerX) / prevZoom;
    const worldY = (board.scrollTop + pointerY) / prevZoom;

    targetZoomRef.current = nextTargetZoom;
    if (zoomFrameRef.current) cancelAnimationFrame(zoomFrameRef.current);

    const animateZoom = () => {
      const activeBoard = boardRef.current;
      if (!activeBoard) return;
      const currentZoom = zoomRef.current;
      const targetZoom = targetZoomRef.current;
      const nextZoom = currentZoom + (targetZoom - currentZoom) * 0.22;
      const done = Math.abs(targetZoom - currentZoom) < 0.0015;
      const appliedZoom = done ? targetZoom : nextZoom;
      zoomRef.current = appliedZoom;
      setZoom(appliedZoom);
      activeBoard.scrollLeft = Math.max(0, worldX * appliedZoom - pointerX);
      activeBoard.scrollTop = Math.max(0, worldY * appliedZoom - pointerY);
      if (!done) {
        zoomFrameRef.current = requestAnimationFrame(animateZoom);
      } else {
        zoomFrameRef.current = 0;
      }
    };

    zoomFrameRef.current = requestAnimationFrame(animateZoom);
  };

  const handleBoardMouseDown = (e) => {
    if (e.button !== 2) return;
    const board = boardRef.current;
    if (!board) return;
    e.preventDefault();
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: board.scrollLeft,
      startScrollTop: board.scrollTop,
    };
  };

  return {
    handleBoardWheel,
    handleBoardMouseDown,
  };
}
