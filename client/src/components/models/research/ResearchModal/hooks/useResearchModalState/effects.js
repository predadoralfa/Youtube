import { useEffect } from "react";

export function useResearchModalEffects({
  open,
  onRequestInventoryFull,
  zoom,
  zoomRef,
  zoomFrameRef,
  setClientNowMs,
  dragStateRef,
  boardRef,
  laneRef,
  setContentSize,
  snapshot,
}) {
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom, zoomRef]);

  useEffect(() => () => {
    if (zoomFrameRef.current) {
      cancelAnimationFrame(zoomFrameRef.current);
      zoomFrameRef.current = 0;
    }
  }, [zoomFrameRef]);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(() => setClientNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [open, setClientNowMs]);

  useEffect(() => {
    if (!open) return;
    onRequestInventoryFull?.();
  }, [open, onRequestInventoryFull]);

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
  }, [open, boardRef, dragStateRef]);

  useEffect(() => {
    if (!open) return undefined;
    const lane = laneRef.current;
    if (!lane || typeof ResizeObserver === "undefined") return undefined;
    function updateSize() {
      setContentSize({
        width: lane.offsetWidth || 1160,
        height: lane.offsetHeight || 620,
      });
    }
    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(lane);
    return () => observer.disconnect();
  }, [open, snapshot, laneRef, setContentSize]);
}
