import { useEffect, useMemo, useRef, useState } from "react";
import { createEntitiesStore } from "../state/entitiesStore";
import { pickBestSelfVitals } from "./helpers";

export function useGameShellState() {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [sessionReplaced, setSessionReplaced] = useState(null);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [researchOpen, setResearchOpen] = useState(false);
  const [buildOpen, setBuildOpen] = useState(false);
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [inventorySnapshot, setInventorySnapshot] = useState(null);
  const [equipmentSnapshot, setEquipmentSnapshot] = useState(null);
  const [inventoryMessage, setInventoryMessage] = useState(null);
  const [equipmentMessage, setEquipmentMessage] = useState(null);
  const [researchMessage, setResearchMessage] = useState(null);
  const [lootNotifications, setLootNotifications] = useState([]);
  const [worldNotifications, setWorldNotifications] = useState([]);
  const [buildPlacement, setBuildPlacement] = useState(null);

  const socketRef = useRef(null);
  const joinedRef = useRef(false);
  const pendingInvRequestRef = useRef(false);
  const inventorySnapshotRef = useRef(null);
  const selectedTargetRef = useRef(null);
  const combatTargetRef = useRef(null);
  const worldStoreRef = useRef(null);
  const stateRef = useRef(null);

  if (!worldStoreRef.current) {
    worldStoreRef.current = createEntitiesStore();
  }

  const selfVitals = useMemo(() => pickBestSelfVitals(snapshot, null), [snapshot]);

  useEffect(() => {
    inventorySnapshotRef.current = inventorySnapshot ?? null;
  }, [inventorySnapshot]);

  if (!stateRef.current) {
    stateRef.current = {
      setLoading,
      setSnapshot,
      setSessionReplaced,
      setInventoryOpen,
      setResearchOpen,
      setBuildOpen,
      setSkillsOpen,
      setInventorySnapshot,
      setEquipmentSnapshot,
      setInventoryMessage,
      setEquipmentMessage,
      setResearchMessage,
      setLootNotifications,
      setWorldNotifications,
      setBuildPlacement,
      socketRef,
      joinedRef,
      pendingInvRequestRef,
      inventorySnapshotRef,
      selectedTargetRef,
      combatTargetRef,
      worldStoreRef,
      loading,
      snapshot,
      sessionReplaced,
      inventoryOpen,
      researchOpen,
      buildOpen,
      skillsOpen,
      inventorySnapshot,
      equipmentSnapshot,
      inventoryMessage,
      equipmentMessage,
      researchMessage,
      lootNotifications,
      worldNotifications,
      buildPlacement,
      selfVitals,
    };
  }

  stateRef.current.loading = loading;
  stateRef.current.snapshot = snapshot;
  stateRef.current.sessionReplaced = sessionReplaced;
  stateRef.current.inventoryOpen = inventoryOpen;
  stateRef.current.researchOpen = researchOpen;
  stateRef.current.buildOpen = buildOpen;
  stateRef.current.skillsOpen = skillsOpen;
  stateRef.current.inventorySnapshot = inventorySnapshot;
  stateRef.current.equipmentSnapshot = equipmentSnapshot;
  stateRef.current.inventoryMessage = inventoryMessage;
  stateRef.current.equipmentMessage = equipmentMessage;
  stateRef.current.researchMessage = researchMessage;
  stateRef.current.lootNotifications = lootNotifications;
  stateRef.current.worldNotifications = worldNotifications;
  stateRef.current.buildPlacement = buildPlacement;
  stateRef.current.selfVitals = selfVitals;

  return stateRef.current;
}
