import { useRef, useState } from "react";

export function useGameCanvasState(currentWorldTime) {
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

  const [marker, setMarker] = useState({ visible: false, x: 0, y: 0 });
  const [floatingDamages, setFloatingDamages] = useState([]);
  const [targetHpBar, setTargetHpBar] = useState(null);
  const [targetPlayerCard, setTargetPlayerCard] = useState(null);
  const [targetLootCard, setTargetLootCard] = useState(null);
  const [selfHpBar, setSelfHpBar] = useState(null);
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
      setMarker,
      setFloatingDamages,
      setTargetHpBar,
      setTargetPlayerCard,
      setTargetLootCard,
      setSelfHpBar,
      marker,
      floatingDamages,
      targetHpBar,
      targetPlayerCard,
      targetLootCard,
      selfHpBar,
    };
  }

  stateRef.current.marker = marker;
  stateRef.current.floatingDamages = floatingDamages;
  stateRef.current.targetHpBar = targetHpBar;
  stateRef.current.targetPlayerCard = targetPlayerCard;
  stateRef.current.targetLootCard = targetLootCard;
  stateRef.current.selfHpBar = selfHpBar;

  return stateRef.current;
}
