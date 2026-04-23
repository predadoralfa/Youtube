import { useRef, useState } from "react";

export function useGameCanvasState(currentWorldTime, buildPlacement = null) {
  const containerRef = useRef(null);
  const worldTimeRef = useRef(currentWorldTime);
  const runtimeRef = useRef(null);
  const templateRef = useRef(null);
  const proceduralMapRef = useRef(null);
  const versionRef = useRef(null);
  const actorsRef = useRef([]);
  const cameraRef = useRef(null);
  const meshByEntityIdRef = useRef(new Map());
  const meshByActorIdRef = useRef(new Map());
  const meshByEnemyIdRef = useRef(new Map());
  const lastSelfIdRef = useRef(null);
  const selectedTargetRef = useRef(null);
  const selectedObjectRef = useRef(null);
  const entityVitalsRef = useRef(new Map());
  const entityPositionsRef = useRef(new Map());
  const seenDamageEventIdsRef = useRef(new Set());
  const predictedEnemyVitalsRef = useRef(new Map());
  const inventorySnapshotRef = useRef(null);
  const buildPlacementRef = useRef(buildPlacement);
  const movementVisualRef = useRef({
    seq: 0,
    mode: "STOP",
    dir: { x: 0, z: 0 },
    clickTarget: null,
    clickRequestedAt: 0,
    lastActiveDir: { x: 0, z: 0 },
    stopRequestedAt: 0,
    directionChangedAt: 0,
    lastAuthorityPos: null,
    lastAuthorityChangeAt: 0,
    predictedVitalsKey: "",
    predictedVitalsAt: 0,
    predictedStaminaCurrent: null,
    predictedStaminaMax: null,
    lastVisualStepAt: 0,
  });
  const debugSelfMeshLoggedRef = useRef(false);

  const [marker, setMarker] = useState({ visible: false, x: 0, y: 0 });
  const [floatingDamages, setFloatingDamages] = useState([]);
  const [targetHpBar, setTargetHpBar] = useState(null);
  const [targetPlayerCard, setTargetPlayerCard] = useState(null);
  const [targetLootCard, setTargetLootCard] = useState(null);
  const [targetBuildCard, setTargetBuildCard] = useState(null);
  const [selfHpBar, setSelfHpBar] = useState(null);
  const [buildPlacementMarker, setBuildPlacementMarker] = useState(null);
  const stateRef = useRef(null);

  if (!stateRef.current) {
    stateRef.current = {
      containerRef,
      worldTimeRef,
      runtimeRef,
      templateRef,
      proceduralMapRef,
      versionRef,
      actorsRef,
      cameraRef,
      meshByEntityIdRef,
      meshByActorIdRef,
      meshByEnemyIdRef,
      lastSelfIdRef,
      selectedTargetRef,
      selectedObjectRef,
      entityVitalsRef,
      entityPositionsRef,
      seenDamageEventIdsRef,
      predictedEnemyVitalsRef,
      inventorySnapshotRef,
      buildPlacementRef,
      movementVisualRef,
      debugSelfMeshLoggedRef,
      setMarker,
      setFloatingDamages,
      setTargetHpBar,
      setTargetPlayerCard,
      setTargetLootCard,
      setTargetBuildCard,
      setSelfHpBar,
      setBuildPlacementMarker,
      marker,
      floatingDamages,
      targetHpBar,
      targetPlayerCard,
      targetLootCard,
      targetBuildCard,
      selfHpBar,
      buildPlacementMarker,
    };
  }

  stateRef.current.marker = marker;
  stateRef.current.floatingDamages = floatingDamages;
  stateRef.current.targetHpBar = targetHpBar;
  stateRef.current.targetPlayerCard = targetPlayerCard;
  stateRef.current.targetLootCard = targetLootCard;
  stateRef.current.targetBuildCard = targetBuildCard;
  stateRef.current.selfHpBar = selfHpBar;
  stateRef.current.buildPlacementMarker = buildPlacementMarker;
  stateRef.current.buildPlacementRef.current = buildPlacement;

  return stateRef.current;
}
