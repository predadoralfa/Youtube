import { useRef, useState } from "react";
import { DEFAULT_ZOOM } from "../../constants";

export function useResearchModalRefs() {
  return {
    boardRef: useRef(null),
    laneRef: useRef(null),
    dragStateRef: useRef(null),
    zoomRef: useRef(DEFAULT_ZOOM),
    targetZoomRef: useRef(DEFAULT_ZOOM),
    zoomFrameRef: useRef(0),
    clientNowMs: useState(() => Date.now()),
    zoom: useState(DEFAULT_ZOOM),
    contentSize: useState({ width: 1160, height: 0 }),
  };
}
