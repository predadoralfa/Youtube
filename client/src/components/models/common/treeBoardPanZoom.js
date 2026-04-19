import { useEffect, useRef, useState } from "react";

export const MIN_ZOOM = 0.4;
export const MAX_ZOOM = 1.45;
export const DEFAULT_ZOOM = 1;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createTreeBoardPanZoomInteractions({
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

export function useTreeBoardPanZoom({ open, contentWidth = 1160, contentHeight = 620 } = {}) {
  const boardRef = useRef(null);
  const laneRef = useRef(null);
  const dragStateRef = useRef(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const targetZoomRef = useRef(DEFAULT_ZOOM);
  const zoomFrameRef = useRef(0);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [contentSize, setContentSize] = useState({ width: contentWidth, height: contentHeight });
  const { handleBoardWheel, handleBoardMouseDown } = createTreeBoardPanZoomInteractions({
    boardRef,
    dragStateRef,
    zoomRef,
    targetZoomRef,
    zoomFrameRef,
    setZoom,
  });

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(
    () => () => {
      if (zoomFrameRef.current) {
        cancelAnimationFrame(zoomFrameRef.current);
        zoomFrameRef.current = 0;
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return undefined;
    function endDrag() {
      dragStateRef.current = null;
    }
    function handleMouseMove(event) {
      const board = boardRef.current;
      const drag = dragStateRef.current;
      if (!board || !drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      board.scrollLeft = drag.startScrollLeft - dx;
      board.scrollTop = drag.startScrollTop - dy;
    }
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const lane = laneRef.current;
    if (!lane || typeof ResizeObserver === "undefined") return undefined;
    function updateSize() {
      setContentSize({
        width: lane.offsetWidth || contentWidth,
        height: lane.offsetHeight || contentHeight,
      });
    }
    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(lane);
    return () => observer.disconnect();
  }, [open, contentWidth, contentHeight]);

  return {
    boardRef,
    laneRef,
    zoom,
    contentSize,
    handleBoardWheel,
    handleBoardMouseDown,
    zoomRef,
    targetZoomRef,
    zoomFrameRef,
    dragStateRef,
    setZoom,
    setContentSize,
  };
}
