import { useResearchModalRefs } from "./refs";
import { useResearchModalDerivedState } from "./derived";
import { useResearchModalEffects } from "./effects";
import { createResearchBoardInteractions } from "./interactions";

export function useResearchModalState(props) {
  const refs = useResearchModalRefs();
  const [clientNowMs, setClientNowMs] = refs.clientNowMs;
  const [zoom, setZoom] = refs.zoom;
  const [contentSize, setContentSize] = refs.contentSize;

  const derived = useResearchModalDerivedState({
    snapshot: props.snapshot,
    clientNowMs,
    inventorySnapshot: props.inventorySnapshot,
    equipmentSnapshot: props.equipmentSnapshot,
  });

  useResearchModalEffects({
    open: props.open,
    onRequestInventoryFull: props.onRequestInventoryFull,
    zoom,
    zoomRef: refs.zoomRef,
    zoomFrameRef: refs.zoomFrameRef,
    setClientNowMs,
    dragStateRef: refs.dragStateRef,
    boardRef: refs.boardRef,
    laneRef: refs.laneRef,
    setContentSize,
    snapshot: props.snapshot,
  });

  return {
    boardRef: refs.boardRef,
    laneRef: refs.laneRef,
    zoom,
    contentSize,
    ...derived,
    ...createResearchBoardInteractions({
      boardRef: refs.boardRef,
      dragStateRef: refs.dragStateRef,
      zoomRef: refs.zoomRef,
      targetZoomRef: refs.targetZoomRef,
      zoomFrameRef: refs.zoomFrameRef,
      setZoom,
    }),
  };
}
