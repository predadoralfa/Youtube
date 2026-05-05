import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GameCanvas } from "@/world/scene/GameCanvas";
import { mergeSnapshotActor, mergeSnapshotSceneObject } from "@/world/GameShell/helpers";
import { isEditorCharacter } from "../Character/editorCharacter";
import { createEditorCharacterMovementController } from "../Character/movement/createEditorCharacterMovementController";
import { projectWorldToScreenPx } from "@/world/scene/GameCanvas/helpers";
import {
  disableActor,
  disableSceneObject,
  spawnActor,
  spawnSceneObject,
  updateActor,
  updateSceneObject,
} from "@editor/services/WorldEditor";
import {
  loadSceneCreatorSettings,
  saveSceneCreatorSettings,
} from "@editor/worldCreator/persistence";
import {
  applyTerrainDraftToSnapshot,
  buildTerrainDraftFromSnapshot,
  getTerrainDraftSignature,
  getTerrainSignature,
} from "./terrainPanel";

const TOKEN_KEY = "token";

function formatNumber(value, digits = 2) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(digits) : "0.00";
}

function radToDeg(value) {
  return THREE.MathUtils.radToDeg(Number(value ?? 0));
}

function degToRad(value) {
  return THREE.MathUtils.degToRad(Number(value ?? 0));
}

function readSelectedEntity(snapshot, selectedTarget) {
  if (!selectedTarget?.kind || selectedTarget?.id == null) return null;

  if (selectedTarget.kind === "ACTOR") {
    const actor = (snapshot?.actors ?? []).find((entry) => String(entry?.id) === String(selectedTarget.id)) ?? null;
    if (!actor) return null;
    return {
      kind: "ACTOR",
      entity: actor,
      type: actor.actorDefCode ?? actor.actorType ?? null,
      pos: actor.pos ?? { x: 0, y: 0, z: 0 },
      yaw: Number(actor.yaw ?? 0),
      rotX: Number(actor.rotX ?? 0),
      rotZ: Number(actor.rotZ ?? 0),
      scale: actor.scale ?? { x: 1, y: 1, z: 1 },
    };
  }

  if (selectedTarget.kind === "OBJECT") {
    const sceneObject =
      (snapshot?.sceneObjects ?? []).find((entry) => String(entry?.id) === String(selectedTarget.id)) ?? null;
    if (!sceneObject || isEditorCharacter(sceneObject)) return null;
    return {
      kind: "OBJECT",
      entity: sceneObject,
      type: sceneObject.objectDefCode ?? sceneObject.objectType ?? null,
      pos: sceneObject.pos ?? { x: 0, y: 0, z: 0 },
      yaw: Number(sceneObject.yaw ?? 0),
      rotX: Number(sceneObject.rotX ?? 0),
      rotZ: Number(sceneObject.rotZ ?? 0),
      scale: sceneObject.scale ?? { x: 1, y: 1, z: 1 },
    };
  }

  return null;
}

function buildSelectableTargets(snapshot) {
  const actors = (snapshot?.actors ?? []).map((entry) => ({
    kind: "ACTOR",
    id: String(entry?.id ?? ""),
    type: entry?.actorDefCode ?? entry?.actorType ?? null,
    label: `Actor #${entry?.id ?? "?"} - ${entry?.actorDefCode ?? entry?.actorType ?? "Sem tipo"}`,
  }));
  const objects = (snapshot?.sceneObjects ?? [])
    .filter((entry) => !isEditorCharacter(entry))
    .map((entry) => ({
      kind: "OBJECT",
      id: String(entry?.id ?? ""),
      type: entry?.objectDefCode ?? entry?.objectType ?? null,
      label: `Object #${entry?.id ?? "?"} - ${entry?.objectDefCode ?? entry?.objectType ?? "Sem tipo"}`,
    }));

  return [...actors, ...objects];
}

function buildSelectedFormFromEntry(selectedEntry) {
  if (!selectedEntry) return null;
  return {
    posX: String(selectedEntry.pos?.x ?? 0),
    posY: String(selectedEntry.pos?.y ?? 0),
    posZ: String(selectedEntry.pos?.z ?? 0),
    rotXDeg: String(radToDeg(selectedEntry.rotX ?? 0)),
    rotYDeg: String(radToDeg(selectedEntry.yaw ?? 0)),
    rotZDeg: String(radToDeg(selectedEntry.rotZ ?? 0)),
    scaleX: String(selectedEntry.scale?.x ?? 1),
    scaleY: String(selectedEntry.scale?.y ?? 1),
    scaleZ: String(selectedEntry.scale?.z ?? 1),
  };
}

function toDraftNumber(value, fallback) {
  if (value === "" || value == null) return fallback;
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function applySelectedDraftToSnapshot(prevSnapshot, selectedTarget, draft) {
  if (!prevSnapshot || !selectedTarget?.kind || selectedTarget?.id == null || !draft) return prevSnapshot;

  const patch = {
    pos: {
      x: toDraftNumber(draft.posX, 0),
      y: toDraftNumber(draft.posY, 0),
      z: toDraftNumber(draft.posZ, 0),
    },
    yaw: degToRad(toDraftNumber(draft.rotYDeg ?? draft.yaw, 0)),
    rotX: degToRad(toDraftNumber(draft.rotXDeg, 0)),
    rotZ: degToRad(toDraftNumber(draft.rotZDeg, 0)),
    scale: {
      x: Math.max(0.01, toDraftNumber(draft.scaleX, 1)),
      y: Math.max(0.01, toDraftNumber(draft.scaleY, 1)),
      z: Math.max(0.01, toDraftNumber(draft.scaleZ, 1)),
    },
  };

  if (selectedTarget.kind === "ACTOR") {
    return mergeSnapshotActor(prevSnapshot, {
      id: selectedTarget.id,
      ...patch,
    });
  }

  if (selectedTarget.kind === "OBJECT") {
    return mergeSnapshotSceneObject(prevSnapshot, {
      id: selectedTarget.id,
      ...patch,
    });
  }

  return prevSnapshot;
}

function CollapsibleSection({ title, children, defaultOpen = false }) {
  return (
    <details
      open={defaultOpen}
      style={{
        borderRadius: 14,
        background: "rgba(255,255,255,0.05)",
        overflow: "hidden",
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          padding: "12px 14px",
          fontWeight: 700,
          listStyle: "none",
        }}
      >
        {title}
      </summary>
      <div style={{ padding: "0 14px 14px", display: "grid", gap: 10 }}>{children}</div>
    </details>
  );
}

function LabeledInput({ label, value, onChange, type = "text", step = "any", min = undefined }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.82 }}>{label}</span>
      <input
        type={type}
        value={value}
        min={min}
        step={step}
        onChange={onChange}
        style={{
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(8,12,18,0.9)",
          color: "#f3f2eb",
          padding: "10px 12px",
        }}
      />
    </label>
  );
}

function SectionButton({ children, onClick, tone = "primary", disabled = false }) {
  const palette =
    tone === "danger"
      ? { background: "#d95d39", color: "#fff4ef" }
      : tone === "muted"
        ? { background: "rgba(255,255,255,0.08)", color: "#f3f2eb" }
        : { background: "#f4b942", color: "#18212a" };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        border: 0,
        borderRadius: 12,
        padding: "11px 14px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontWeight: 700,
        opacity: disabled ? 0.6 : 1,
        ...palette,
      }}
    >
      {children}
    </button>
  );
}

function EditorCharacterLabel({ state }) {
  const [labelState, setLabelState] = useState({
    visible: false,
    x: 0,
    y: 0,
    text: "0.00, 0.00, 0.00",
  });

  useEffect(() => {
    let alive = true;
    const step = () => {
      if (!alive) return;
      const isVisible = state.editorCharacterVisibleRef?.current !== false;
      const camera = state.cameraRef?.current ?? null;
      const canvas = state.containerRef?.current?.querySelector("canvas") ?? null;
      const pos = state.editorCharacterRef?.current?.pos ?? null;

      if (isVisible && camera && canvas && pos) {
        const projected = projectWorldToScreenPx(
          new THREE.Vector3(Number(pos.x ?? 0), Number(pos.y ?? 0) + 2.4, Number(pos.z ?? 0)),
          camera,
          canvas
        );

        if (projected) {
          setLabelState({
            visible: true,
            x: projected.x,
            y: projected.y,
            text: `${formatNumber(pos.x)}, ${formatNumber(pos.y)}, ${formatNumber(pos.z)}`,
          });
        } else {
          setLabelState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        }
      } else {
        setLabelState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
    return () => {
      alive = false;
    };
  }, [state]);

  if (!labelState.visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: labelState.x,
        top: labelState.y,
        transform: "translate(-50%, -110%)",
        zIndex: 1260,
        pointerEvents: "none",
        display: "grid",
        gap: 4,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(16, 18, 22, 0.45)",
        border: "1px solid rgba(244, 185, 66, 0.22)",
        justifyItems: "center",
        color: "#f4b942",
        textShadow: "0 2px 10px rgba(0,0,0,0.8)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800 }}>GM Character</div>
      <div style={{ fontSize: 10, opacity: 0.9 }}>
        XYZ {labelState.text}
      </div>
    </div>
  );
}

function EditorFpsBadge() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let alive = true;
    let lastAt = performance.now();
    let frameCount = 0;

    const step = () => {
      if (!alive) return;
      frameCount += 1;
      const now = performance.now();
      const elapsed = now - lastAt;

      if (elapsed >= 500) {
        const nextFps = Math.round((frameCount * 1000) / elapsed);
        setFps(nextFps);
        frameCount = 0;
        lastAt = now;
      }

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        right: 10,
        zIndex: 5200,
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(10, 14, 18, 0.82)",
        color: "#f4b942",
        fontWeight: 900,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
        pointerEvents: "none",
      }}
    >
      FPS {fps || "--"}
    </div>
  );
}

function LabeledSliderInput({
  label,
  value,
  onChange,
  min,
  max,
  step = "1",
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontSize: 12, opacity: 0.82 }}>{label}</span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        style={{ width: "100%" }}
      />
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={onChange}
        style={{
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(8,12,18,0.9)",
          color: "#f3f2eb",
          padding: "10px 12px",
        }}
      />
    </label>
  );
}

function GmPanel({ open, moveStep, onMoveStepChange, characterVisible, onCharacterVisibleChange }) {
  if (!open) return null;

  return (
    <aside
      data-scene-creator-scroll-panel="true"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1210,
        width: 320,
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto",
        padding: 16,
        borderRadius: 18,
        background: "rgba(13, 20, 28, 0.9)",
        color: "#f3f2eb",
        backdropFilter: "blur(14px)",
        boxShadow: "0 18px 45px rgba(0, 0, 0, 0.28)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7 }}>
          GM
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          Painel do GM
        </div>
      </div>

      <CollapsibleSection title="Locomocao" defaultOpen>
        <LabeledInput
          label="Velocidade de movimento"
          value={moveStep}
          type="number"
          min="0.1"
          step="0.1"
          onChange={(e) => onMoveStepChange(e.target.value)}
        />
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={characterVisible}
            onChange={(e) => onCharacterVisibleChange(e.target.checked)}
          />
          <span>GM visivel</span>
        </label>
        <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.4 }}>
          Use `WASD` para mover, `Ctrl` para acelerar e `5` para abrir ou fechar este painel.
        </div>
      </CollapsibleSection>
    </aside>
  );
}

function SpawnPanel({
  open,
  actorDefs,
  objectDefs,
  spawnActorDefId,
  onSpawnActorDefIdChange,
  useCurrentPositionActor,
  onUseCurrentPositionActorChange,
  spawnActorPos,
  onSpawnActorPosChange,
  onSpawnActor,
  spawnObjectDefId,
  onSpawnObjectDefIdChange,
  useCurrentPositionObject,
  onUseCurrentPositionObjectChange,
  spawnObjectPos,
  onSpawnObjectPosChange,
  onSpawnObject,
  gmPanelOpen,
}) {
  if (!open) return null;

  return (
    <aside
      data-scene-creator-scroll-panel="true"
      style={{
        position: "fixed",
        top: 16,
        right: gmPanelOpen ? 352 : 16,
        zIndex: 1209,
        width: 320,
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto",
        padding: 16,
        borderRadius: 18,
        background: "rgba(13, 20, 28, 0.9)",
        color: "#f3f2eb",
        backdropFilter: "blur(14px)",
        boxShadow: "0 18px 45px rgba(0, 0, 0, 0.28)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7 }}>
          Spawn
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          Painel de Spawn
        </div>
      </div>

      <CollapsibleSection title="Spawn Actor" defaultOpen>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.82 }}>Tipo de actor</span>
          <select
            value={spawnActorDefId}
            onChange={(e) => onSpawnActorDefIdChange(e.target.value)}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(8,12,18,0.9)",
              color: "#f3f2eb",
              padding: "10px 12px",
            }}
          >
            <option value="">Selecione um actor</option>
            {actorDefs.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.code} - {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={useCurrentPositionActor} onChange={(e) => onUseCurrentPositionActorChange(e.target.checked)} />
          <span>Usar posicao atual do GM</span>
        </label>
        {!useCurrentPositionActor ? (
          <>
            <LabeledInput label="Position X" value={spawnActorPos.x} type="number" onChange={(e) => onSpawnActorPosChange((prev) => ({ ...prev, x: e.target.value }))} />
            <LabeledInput label="Position Y" value={spawnActorPos.y} type="number" onChange={(e) => onSpawnActorPosChange((prev) => ({ ...prev, y: e.target.value }))} />
            <LabeledInput label="Position Z" value={spawnActorPos.z} type="number" onChange={(e) => onSpawnActorPosChange((prev) => ({ ...prev, z: e.target.value }))} />
          </>
        ) : null}
        <SectionButton onClick={onSpawnActor} disabled={!spawnActorDefId}>OK</SectionButton>
      </CollapsibleSection>

      <CollapsibleSection title="Spawn Object" defaultOpen>
        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 12, opacity: 0.82 }}>Tipo de object</span>
          <select
            value={spawnObjectDefId}
            onChange={(e) => onSpawnObjectDefIdChange(e.target.value)}
            style={{
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(8,12,18,0.9)",
              color: "#f3f2eb",
              padding: "10px 12px",
            }}
          >
            <option value="">Selecione um object</option>
            {objectDefs.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.code} - {entry.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={useCurrentPositionObject} onChange={(e) => onUseCurrentPositionObjectChange(e.target.checked)} />
          <span>Usar posicao atual do GM</span>
        </label>
        {!useCurrentPositionObject ? (
          <>
            <LabeledInput label="Position X" value={spawnObjectPos.x} type="number" onChange={(e) => onSpawnObjectPosChange((prev) => ({ ...prev, x: e.target.value }))} />
            <LabeledInput label="Position Y" value={spawnObjectPos.y} type="number" onChange={(e) => onSpawnObjectPosChange((prev) => ({ ...prev, y: e.target.value }))} />
            <LabeledInput label="Position Z" value={spawnObjectPos.z} type="number" onChange={(e) => onSpawnObjectPosChange((prev) => ({ ...prev, z: e.target.value }))} />
          </>
        ) : null}
        <SectionButton onClick={onSpawnObject} disabled={!spawnObjectDefId}>OK</SectionButton>
      </CollapsibleSection>
    </aside>
  );
}

function getDockRightOffset({ gmPanelOpen, spawnPanelOpen, terrainPanelOpen }) {
  return 16 + (gmPanelOpen ? 336 : 0) + (spawnPanelOpen ? 336 : 0) + (terrainPanelOpen ? 336 : 0);
}

function TerrainPanel({
  open,
  snapshot,
  terrainForm,
  onTerrainChange,
  gmPanelOpen,
  spawnPanelOpen,
}) {
  if (!open) return null;

  const template = snapshot?.localTemplate ?? {};
  const visual = template?.visual ?? {};
  const proceduralMap = snapshot?.proceduralMap ?? {};
  const terrain = proceduralMap?.terrain ?? {};
  const scatter = proceduralMap?.scatter ?? {};

  return (
    <aside
      data-scene-creator-scroll-panel="true"
      style={{
        position: "fixed",
        top: 16,
        right: getDockRightOffset({
          gmPanelOpen,
          spawnPanelOpen,
          terrainPanelOpen: false,
        }),
        zIndex: 1209,
        width: 320,
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto",
        padding: 16,
        borderRadius: 18,
        background: "rgba(13, 20, 28, 0.9)",
        color: "#f3f2eb",
        backdropFilter: "blur(14px)",
        boxShadow: "0 18px 45px rgba(0, 0, 0, 0.28)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7 }}>
          Terrain
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          Painel de Terreno
        </div>
      </div>

      <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.4 }}>
        O editor usa `localTemplate.geometry`, `ground_render_material.base_color` e `proceduralMap` para montar o chão.
        As alterações abaixo aplicam em tempo real no snapshot local.
      </div>

      <CollapsibleSection title="Base Visual" defaultOpen>
        <div style={{ display: "grid", gap: 6, fontSize: 12, opacity: 0.88 }}>
          <div>Ground material: <strong>{visual?.ground_material?.code ?? "-"}</strong></div>
          <div>Ground mesh: <strong>{visual?.ground_mesh?.code ?? "-"}</strong></div>
          <div>Render material: <strong>{visual?.ground_render_material?.code ?? "-"}</strong></div>
        </div>
        <LabeledInput label="Size X" value={terrainForm.sizeX} type="number" onChange={(e) => onTerrainChange("sizeX", e.target.value)} />
        <LabeledInput label="Size Z" value={terrainForm.sizeZ} type="number" onChange={(e) => onTerrainChange("sizeZ", e.target.value)} />
        <LabeledInput label="Ground color" value={terrainForm.groundColor} type="color" onChange={(e) => onTerrainChange("groundColor", e.target.value)} />
        <LabeledInput label="World seed" value={terrainForm.worldSeed} type="number" onChange={(e) => onTerrainChange("worldSeed", e.target.value)} />
        <LabeledInput label="Chunk size" value={terrainForm.chunkSize} type="number" min="64" step="1" onChange={(e) => onTerrainChange("chunkSize", e.target.value)} />
        <LabeledInput label="Chunk radius" value={terrainForm.chunkRadius} type="number" min="0" step="1" onChange={(e) => onTerrainChange("chunkRadius", e.target.value)} />
      </CollapsibleSection>

      <CollapsibleSection title="Terrain" defaultOpen>
        <LabeledSliderInput label="Height amplitude" value={terrainForm.heightAmplitude} min="0" max="6" step="0.1" onChange={(e) => onTerrainChange("heightAmplitude", e.target.value)} />
        <LabeledSliderInput label="Roughness" value={terrainForm.roughness} min="0" max="3" step="0.01" onChange={(e) => onTerrainChange("roughness", e.target.value)} />
        <LabeledSliderInput label="Plateau ratio" value={terrainForm.plateauRatio} min="0" max="2" step="0.01" onChange={(e) => onTerrainChange("plateauRatio", e.target.value)} />
        <LabeledSliderInput label="Slope limit" value={terrainForm.slopeLimit} min="0" max="3" step="0.01" onChange={(e) => onTerrainChange("slopeLimit", e.target.value)} />
        <LabeledSliderInput label="Valley depth" value={terrainForm.valleyDepth} min="0" max="3" step="0.01" onChange={(e) => onTerrainChange("valleyDepth", e.target.value)} />
      </CollapsibleSection>

      <CollapsibleSection title="Scatter" defaultOpen>
        <LabeledSliderInput label="Grass density" value={terrainForm.grassDensity} min="0" max="2" step="0.01" onChange={(e) => onTerrainChange("grassDensity", e.target.value)} />
        <LabeledSliderInput label="Tree density" value={terrainForm.treeDensity} min="0" max="2" step="0.01" onChange={(e) => onTerrainChange("treeDensity", e.target.value)} />
        <LabeledSliderInput label="Rock density" value={terrainForm.rockDensity} min="0" max="2" step="0.01" onChange={(e) => onTerrainChange("rockDensity", e.target.value)} />
        <LabeledSliderInput label="Max slope" value={terrainForm.maxSlope} min="0" max="2" step="0.01" onChange={(e) => onTerrainChange("maxSlope", e.target.value)} />
        <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.4 }}>
          `ground_material` e `ground_mesh` aparecem só como referência de origem. O editor renderiza o terreno por geometria + cor + procedural.
        </div>
      </CollapsibleSection>
    </aside>
  );
}

function SelectedPanel({
  selectedEntry,
  selectedForm,
  onSelectedFormChange,
  onSaveSelected,
  onDisableSelected,
  gmPanelOpen,
  spawnPanelOpen,
  terrainPanelOpen,
}) {
  if (!selectedEntry || !selectedForm) return null;

  return (
    <aside
      data-scene-creator-scroll-panel="true"
      style={{
        position: "fixed",
        top: 16,
        right: getDockRightOffset({
          gmPanelOpen,
          spawnPanelOpen,
          terrainPanelOpen,
        }),
        zIndex: 1209,
        width: 320,
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto",
        padding: 16,
        borderRadius: 18,
        background: "rgba(13, 20, 28, 0.9)",
        color: "#f3f2eb",
        backdropFilter: "blur(14px)",
        boxShadow: "0 18px 45px rgba(0, 0, 0, 0.28)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        display: "grid",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7 }}>
          Selected
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
          Entidade Selecionada
        </div>
      </div>

      <CollapsibleSection title="Transform" defaultOpen>
        <div>Kind: <strong>{selectedEntry.kind}</strong></div>
        <div>ID: <strong>{selectedEntry.entity?.id}</strong></div>
        <div>Type: <strong>{selectedEntry.type ?? "-"}</strong></div>
        <LabeledInput label="Position X" value={selectedForm.posX} type="number" onChange={(e) => onSelectedFormChange("posX", e.target.value)} />
        <LabeledInput label="Position Y" value={selectedForm.posY} type="number" onChange={(e) => onSelectedFormChange("posY", e.target.value)} />
        <LabeledInput label="Position Z" value={selectedForm.posZ} type="number" onChange={(e) => onSelectedFormChange("posZ", e.target.value)} />
        <LabeledSliderInput label="Rotation X (graus)" value={selectedForm.rotXDeg} min="-180" max="180" step="1" onChange={(e) => onSelectedFormChange("rotXDeg", e.target.value)} />
        <LabeledSliderInput label="Rotation Y (graus)" value={selectedForm.rotYDeg} min="-180" max="180" step="1" onChange={(e) => onSelectedFormChange("rotYDeg", e.target.value)} />
        <LabeledSliderInput label="Rotation Z (graus)" value={selectedForm.rotZDeg} min="-180" max="180" step="1" onChange={(e) => onSelectedFormChange("rotZDeg", e.target.value)} />
        <LabeledSliderInput label="Scale X" value={selectedForm.scaleX} min="0.01" max="5" step="0.01" onChange={(e) => onSelectedFormChange("scaleX", e.target.value)} />
        <LabeledSliderInput label="Scale Y" value={selectedForm.scaleY} min="0.01" max="5" step="0.01" onChange={(e) => onSelectedFormChange("scaleY", e.target.value)} />
        <LabeledSliderInput label="Scale Z" value={selectedForm.scaleZ} min="0.01" max="5" step="0.01" onChange={(e) => onSelectedFormChange("scaleZ", e.target.value)} />
        <div style={{ display: "flex", gap: 8 }}>
          <SectionButton onClick={onSaveSelected}>Salvar</SectionButton>
          <SectionButton tone="danger" onClick={onDisableSelected}>Disable</SectionButton>
        </div>
      </CollapsibleSection>
    </aside>
  );
}

function EditorMotionDebugPanel({ state }) {
  const [debugState, setDebugState] = useState({
    cameraYaw: 0,
    cameraRotationY: 0,
    characterYaw: 0,
    moveInput: 0,
    strafeInput: 0,
    focusX: 0,
    focusZ: 0,
    keydownCount: 0,
    keyupCount: 0,
    orbitCount: 0,
    zoomCount: 0,
    lastEvent: "idle",
    activeElementTag: "none",
    lastKey: "none",
    lastCode: "none",
    lastRepeat: false,
    keys: { w: false, a: false, s: false, d: false, ctrl: false },
  });

  useEffect(() => {
    let alive = true;
    const step = () => {
      if (!alive) return;

      const camera = state.cameraRef?.current ?? null;
      const cameraApi = state.cameraApiRef?.current ?? null;
      const character = state.editorCharacterRef?.current ?? null;
      const focus = state.editorCameraFocusRef?.current ?? null;
      const keys = state.editorInputStateRef?.current ?? null;
      const forward = new THREE.Vector3();
      let cameraYaw = Number(cameraApi?.getState?.().yaw ?? 0);
      let cameraRotationY = 0;

      if (cameraApi?.getState) {
        const cameraState = cameraApi.getState();
        if (Number.isFinite(Number(cameraState?.yaw))) {
          cameraYaw = Number(cameraState.yaw);
        }
      }

      if (camera) {
        cameraRotationY = Number(camera.rotation?.y ?? 0);
        camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() > 0.000001) {
          forward.normalize();
          if (!Number.isFinite(cameraYaw)) {
            cameraYaw = Math.atan2(-forward.x, -forward.z);
          }
        }
      }

      setDebugState({
        cameraYaw,
        cameraRotationY,
        characterYaw: Number(character?.yaw ?? 0),
        moveInput: Number(keys?.moveInput ?? 0),
        strafeInput: Number(keys?.strafeInput ?? 0),
        focusX: Number(focus?.x ?? 0),
        focusZ: Number(focus?.z ?? 0),
        keydownCount: Number(keys?.keydownCount ?? 0),
        keyupCount: Number(keys?.keyupCount ?? 0),
        orbitCount: Number(keys?.orbitCount ?? 0),
        zoomCount: Number(keys?.zoomCount ?? 0),
        lastEvent: String(keys?.lastEvent ?? "idle"),
        activeElementTag: String(keys?.activeElementTag ?? "none"),
        lastKey: String(keys?.lastKey ?? "none"),
        lastCode: String(keys?.lastCode ?? "none"),
        lastRepeat: Boolean(keys?.lastRepeat ?? false),
        keys: {
          w: Boolean(keys?.w),
          a: Boolean(keys?.a),
          s: Boolean(keys?.s),
          d: Boolean(keys?.d),
          ctrl: Boolean(keys?.ctrl),
        },
      });

      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
    return () => {
      alive = false;
    };
  }, [state]);

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 1270,
        pointerEvents: "none",
        minWidth: 280,
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(10, 14, 18, 0.72)",
        border: "1px solid rgba(244, 185, 66, 0.22)",
        color: "#f6f1df",
        fontSize: 12,
        lineHeight: 1.45,
        boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontWeight: 800, color: "#f4b942", marginBottom: 8 }}>Scene Creator Debug</div>
      <div>camYaw: {formatNumber(debugState.cameraYaw, 3)}</div>
      <div>camRotY: {formatNumber(debugState.cameraRotationY, 3)}</div>
      <div>charYaw: {formatNumber(debugState.characterYaw, 3)}</div>
      <div>move: {formatNumber(debugState.moveInput, 1)} strafe: {formatNumber(debugState.strafeInput, 1)}</div>
      <div>focus: {formatNumber(debugState.focusX, 2)}, {formatNumber(debugState.focusZ, 2)}</div>
      <div>keydown: {debugState.keydownCount} keyup: {debugState.keyupCount}</div>
      <div>orbit: {debugState.orbitCount} zoom: {debugState.zoomCount}</div>
      <div>last: {debugState.lastEvent}</div>
      <div>key: {debugState.lastKey} code: {debugState.lastCode} repeat: {debugState.lastRepeat ? "1" : "0"}</div>
      <div>focusEl: {debugState.activeElementTag}</div>
      <div>
        keys: W={debugState.keys.w ? "1" : "0"} A={debugState.keys.a ? "1" : "0"} S={debugState.keys.s ? "1" : "0"} D=
        {debugState.keys.d ? "1" : "0"} Ctrl={debugState.keys.ctrl ? "1" : "0"}
      </div>
    </div>
  );
}

function SidePanel({
  state,
  onLogout,
  selectableTargets,
  selectedTargetKey,
  onSelectTarget,
  open,
  position,
  onDragPointerDown,
}) {
  if (!open) return null;
  const operator = state.editorMeta?.editor?.operator ?? null;
  const instance = state.editorMeta?.instance ?? null;

  useEffect(() => {
    if (!state.flashMessage) return undefined;
    const timeoutId = window.setTimeout(() => state.setFlashMessage(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [state, state.flashMessage]);

  return (
    <aside
      data-scene-creator-scroll-panel="true"
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 1200,
        width: 360,
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto",
        padding: 16,
        borderRadius: 18,
        background: "rgba(13, 20, 28, 0.9)",
        color: "#f3f2eb",
        backdropFilter: "blur(14px)",
        boxShadow: "0 18px 45px rgba(0, 0, 0, 0.28)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase", opacity: 0.7 }}>
            Scene Creator
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>
            Editor de Cena
          </div>
        </div>
        <SectionButton onClick={onLogout}>Sair</SectionButton>
      </div>
      <button
        type="button"
        onPointerDown={onDragPointerDown}
        style={{
          border: "1px dashed rgba(244, 185, 66, 0.35)",
          borderRadius: 12,
          background: "rgba(244, 185, 66, 0.08)",
          color: "#f4b942",
          padding: "8px 10px",
          textAlign: "left",
          cursor: "grab",
          fontWeight: 700,
        }}
      >
        Arrastar painel
      </button>

      {state.flashMessage ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "rgba(244, 185, 66, 0.14)",
            color: "#f6d98d",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {state.flashMessage}
        </div>
      ) : null}

      <CollapsibleSection title="Resumo" defaultOpen>
        <div>ID da instancia: {instance?.id ?? "-"}</div>
        <div>Status: {instance?.status ?? "-"}</div>
        <div>Actors: {state.counts.actors}</div>
        <div>Objects: {state.counts.sceneObjects}</div>
      </CollapsibleSection>

      <CollapsibleSection title="Selecionar Actor ou Object" defaultOpen>
        <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
          {selectableTargets.length === 0 ? (
            <div style={{ opacity: 0.7 }}>Nenhuma entidade disponivel.</div>
          ) : selectableTargets.map((entry, index) => {
            const entryKey = `${entry.kind}:${entry.id}`;
            const selected = entryKey === selectedTargetKey;
            return (
              <button
                key={entryKey}
                type="button"
                onClick={() => onSelectTarget(entryKey)}
                style={{
                  textAlign: "left",
                  borderRadius: 10,
                  border: selected ? "1px solid rgba(244, 185, 66, 0.7)" : "1px solid rgba(255,255,255,0.08)",
                  background: selected ? "rgba(244, 185, 66, 0.16)" : "rgba(8,12,18,0.9)",
                  color: "#f3f2eb",
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "grid",
                  gap: 2,
                }}
              >
                <span style={{ fontSize: 11, opacity: 0.65, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {index + 1}. {entry.kind}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{entry.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, opacity: 0.72, lineHeight: 1.4 }}>
          Use `WASD` para mover o pivô invisível e `Ctrl` para acelerar. O seletor acima serve para recuperar entidades fora do raycast.
        </div>
      </CollapsibleSection>

    </aside>
  );
}

export function WorldCreatorView({ state, onLogout }) {
  const persistedSettings = useMemo(() => loadSceneCreatorSettings(), []);
  const editorCameraOptions = useMemo(
    () => ({
      pivotHeight: 1.35,
      defaultPitch: THREE.MathUtils.degToRad(24),
      defaultDistance: 12,
      minPitch: THREE.MathUtils.degToRad(5),
      maxPitch: THREE.MathUtils.degToRad(86),
    }),
    []
  );
  const [mainPanelOpen, setMainPanelOpen] = useState(Boolean(persistedSettings.mainPanelOpen ?? true));
  const [mainPanelPosition, setMainPanelPosition] = useState(
    persistedSettings.mainPanelPosition ?? { top: 16, left: 16 }
  );
  const [gmPanelOpen, setGmPanelOpen] = useState(Boolean(persistedSettings.gmPanelOpen ?? false));
  const [spawnPanelOpen, setSpawnPanelOpen] = useState(Boolean(persistedSettings.spawnPanelOpen ?? false));
  const [terrainPanelOpen, setTerrainPanelOpen] = useState(Boolean(persistedSettings.terrainPanelOpen ?? false));
  const [gmMoveStep, setGmMoveStep] = useState(String(persistedSettings.gmMoveStep ?? state.editorMoveSpeedRef.current ?? 10));
  const [gmCharacterVisible, setGmCharacterVisible] = useState(Boolean(persistedSettings.gmCharacterVisible ?? true));
  const [spawnActorDefId, setSpawnActorDefId] = useState("");
  const [spawnObjectDefId, setSpawnObjectDefId] = useState("");
  const [useCurrentPositionActor, setUseCurrentPositionActor] = useState(true);
  const [useCurrentPositionObject, setUseCurrentPositionObject] = useState(true);
  const [spawnActorPos, setSpawnActorPos] = useState({ x: "0", y: "0", z: "0" });
  const [spawnObjectPos, setSpawnObjectPos] = useState({ x: "0", y: "0", z: "0" });
  const [terrainForm, setTerrainForm] = useState(() => buildTerrainDraftFromSnapshot(state.snapshot));
  const selectableTargets = useMemo(() => buildSelectableTargets(state.snapshot), [state.snapshot]);
  const selectedEntry = useMemo(
    () => readSelectedEntity(state.snapshot, state.selectedTarget),
    [state.selectedTarget, state.snapshot]
  );
  const actorDefs = state.catalogs?.actorDefs ?? [];
  const objectDefs = state.catalogs?.objectDefs ?? [];
  const selectedTargetKey = state.selectedTarget?.kind && state.selectedTarget?.id != null
    ? `${state.selectedTarget.kind}:${state.selectedTarget.id}`
    : "";
  const [selectedForm, setSelectedForm] = useState(null);
  const lastSelectedTargetKeyRef = useRef("");
  const pendingPersistedGmPosRef = useRef(persistedSettings.gmPos ?? null);
  const lastTerrainSignatureRef = useRef(getTerrainSignature(state.snapshot));

  const handleTargetSelect = useCallback((target) => state.setSelectedTarget(target), [state]);
  const handleTargetClear = useCallback(() => state.setSelectedTarget(null), [state]);
  const handleLogoutClick = useCallback(() => onLogout(), [onLogout]);
  const handleMainPanelDragPointerDown = useCallback((event) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const startX = Number(event.clientX ?? 0);
    const startY = Number(event.clientY ?? 0);
    const startTop = Number(mainPanelPosition.top ?? 16);
    const startLeft = Number(mainPanelPosition.left ?? 16);

    const handlePointerMove = (moveEvent) => {
      const dx = Number(moveEvent.clientX ?? 0) - startX;
      const dy = Number(moveEvent.clientY ?? 0) - startY;
      setMainPanelPosition({
        top: Math.max(8, startTop + dy),
        left: Math.max(8, startLeft + dx),
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
    };

    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
  }, [mainPanelPosition.left, mainPanelPosition.top]);
  const handleSelectTargetByKey = useCallback((value) => {
    if (!value) {
      state.setSelectedTarget(null);
      return;
    }
    const [kind, ...rest] = String(value).split(":");
    const id = rest.join(":");
    if (!kind || !id) return;
    state.setSelectedTarget({ kind, id });
  }, [state]);
  const handleSelectedFormChange = useCallback((field, value) => {
    setSelectedForm((prev) => {
      const base =
        prev ??
        buildSelectedFormFromEntry(selectedEntry) ?? {
          posX: "0",
          posY: "0",
          posZ: "0",
          rotXDeg: "0",
          rotYDeg: "0",
          rotZDeg: "0",
          scaleX: "1",
          scaleY: "1",
          scaleZ: "1",
        };
      const next = {
        ...base,
        [field]: value,
      };
      state.setSnapshot((prevSnapshot) => applySelectedDraftToSnapshot(prevSnapshot, state.selectedTarget, next));
      return next;
    });
  }, [selectedEntry, state]);
  const handleSaveSelected = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !selectedEntry || !selectedForm) return;
    const payload = {
      pos: {
        x: Number(selectedForm.posX ?? 0),
        y: Number(selectedForm.posY ?? 0),
        z: Number(selectedForm.posZ ?? 0),
      },
      yaw: degToRad(Number(selectedForm.rotYDeg ?? 0)),
      scale: {
        x: Number(selectedForm.scaleX ?? 1),
        y: Number(selectedForm.scaleY ?? 1),
        z: Number(selectedForm.scaleZ ?? 1),
      },
    };

    if (selectedEntry.kind === "ACTOR") {
      const result = await updateActor(token, selectedEntry.entity.id, payload);
      if (result?.error) {
        state.setFlashMessage(`Falha ao atualizar actor: ${result.message}`);
        return;
      }
      state.setSnapshot((prev) => mergeSnapshotActor(prev, result.actor));
      state.setFlashMessage(`Actor #${result.actor?.id ?? "?"} atualizado`);
      return;
    }

    const result = await updateSceneObject(token, selectedEntry.entity.id, payload);
    if (result?.error) {
      state.setFlashMessage(`Falha ao atualizar object: ${result.message}`);
      return;
    }
    state.setSnapshot((prev) => mergeSnapshotSceneObject(prev, result.sceneObject));
    state.setFlashMessage(`Object #${result.sceneObject?.id ?? "?"} atualizado`);
  }, [selectedEntry, selectedForm, state]);
  const handleDisableSelected = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !selectedEntry) return;

    if (selectedEntry.kind === "ACTOR") {
      const result = await disableActor(token, selectedEntry.entity.id);
      if (result?.error) {
        state.setFlashMessage(`Falha ao desativar actor: ${result.message}`);
        return;
      }
      state.setSnapshot((prev) => mergeSnapshotActor(prev, result.actor));
      state.setSelectedTarget(null);
      state.setFlashMessage(`Actor #${result.actor?.id ?? "?"} desativado`);
      return;
    }

    const result = await disableSceneObject(token, selectedEntry.entity.id);
    if (result?.error) {
      state.setFlashMessage(`Falha ao desativar object: ${result.message}`);
      return;
    }
    state.setSnapshot((prev) => mergeSnapshotSceneObject(prev, result.sceneObject));
    state.setSelectedTarget(null);
    state.setFlashMessage(`Object #${result.sceneObject?.id ?? "?"} desativado`);
  }, [selectedEntry, state]);
  const handleTerrainChange = useCallback(
    (field, value) => {
      setTerrainForm((prev) => {
        const next = {
          ...prev,
          [field]: value,
        };
        lastTerrainSignatureRef.current = getTerrainDraftSignature(next);
        state.setSnapshot((prevSnapshot) => applyTerrainDraftToSnapshot(prevSnapshot, next));
        return next;
      });
    },
    [state]
  );
  const handleSpawnActor = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !spawnActorDefId) return;
    const payload = {
      actorDefId: Number(spawnActorDefId),
      useCurrentPosition: useCurrentPositionActor,
      pos: {
        x: Number(spawnActorPos.x ?? 0),
        y: Number(spawnActorPos.y ?? 0),
        z: Number(spawnActorPos.z ?? 0),
      },
    };
    const result = await spawnActor(token, payload);
    if (result?.error) {
      state.setFlashMessage(`Falha ao spawnar actor: ${result.message}`);
      return;
    }
    state.setSnapshot((prev) => mergeSnapshotActor(prev, result.actor));
    state.setSelectedTarget({ kind: "ACTOR", id: String(result.actor?.id ?? "") });
    state.setFlashMessage(`Actor #${result.actor?.id ?? "?"} criado`);
  }, [spawnActorDefId, spawnActorPos, state, useCurrentPositionActor]);
  const handleSpawnObject = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || !spawnObjectDefId) return;
    const payload = {
      sceneObjectDefId: Number(spawnObjectDefId),
      useCurrentPosition: useCurrentPositionObject,
      pos: {
        x: Number(spawnObjectPos.x ?? 0),
        y: Number(spawnObjectPos.y ?? 0),
        z: Number(spawnObjectPos.z ?? 0),
      },
    };
    const result = await spawnSceneObject(token, payload);
    if (result?.error) {
      state.setFlashMessage(`Falha ao spawnar object: ${result.message}`);
      return;
    }
    state.setSnapshot((prev) => mergeSnapshotSceneObject(prev, result.sceneObject));
    state.setSelectedTarget({ kind: "OBJECT", id: String(result.sceneObject?.id ?? "") });
    state.setFlashMessage(`Object #${result.sceneObject?.id ?? "?"} criado`);
  }, [spawnObjectDefId, spawnObjectPos, state, useCurrentPositionObject]);
  const handleEditorTick = useCallback(
    ({ pos, yaw }) => {
      const nextPos = {
        x: Number(pos?.x ?? 0),
        y: Number(pos?.y ?? 0),
        z: Number(pos?.z ?? 0),
      };
      const cameraYaw = Number(yaw ?? 0);
      const nextYaw = cameraYaw + Math.PI;

      if (state.editorAnchorRef?.current) {
        state.editorAnchorRef.current = nextPos;
      }
      if (state.editorCharacterRef?.current) {
        state.editorCharacterRef.current.pos = nextPos;
        state.editorCharacterRef.current.yaw = nextYaw;
      }
      if (state.editorInputStateRef?.current) {
        state.editorInputStateRef.current = {
          ...state.editorInputStateRef.current,
          cameraYaw,
          characterYaw: nextYaw,
          focusX: nextPos.x,
          focusY: nextPos.y,
          focusZ: nextPos.z,
        };
      }
      pendingPersistedGmPosRef.current = nextPos;
    },
    [state]
  );

  useEffect(() => {
    const hideStatsPanel = () => {
      const container = state.containerRef?.current ?? null;
      const statsPanel = container?.querySelector?.('[data-debug-panel="game-canvas-stats-panel"]') ?? null;
      if (!statsPanel) return false;

      statsPanel.style.display = "none";
      return true;
    };

    const timer = window.setInterval(() => {
      hideStatsPanel();
    }, 250);

    hideStatsPanel();

    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    return createEditorCharacterMovementController({ state });
  }, [state]);

  useEffect(() => {
    state.editorMoveSpeedRef.current = Math.max(0.1, Number(gmMoveStep) || 10);
  }, [gmMoveStep, state]);

  useEffect(() => {
    state.editorCharacterVisibleRef.current = gmCharacterVisible;
  }, [gmCharacterVisible, state]);

  useEffect(() => {
    saveSceneCreatorSettings({
      mainPanelOpen,
      mainPanelPosition,
      gmPanelOpen,
      spawnPanelOpen,
      terrainPanelOpen,
      gmMoveStep,
      gmCharacterVisible,
    });
  }, [gmCharacterVisible, gmMoveStep, gmPanelOpen, mainPanelOpen, mainPanelPosition, spawnPanelOpen, terrainPanelOpen]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!pendingPersistedGmPosRef.current) return;
      saveSceneCreatorSettings({ gmPos: pendingPersistedGmPosRef.current });
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedEntry) {
      setSelectedForm(null);
      lastSelectedTargetKeyRef.current = "";
      return;
    }
    if (lastSelectedTargetKeyRef.current === selectedTargetKey) return;
    lastSelectedTargetKeyRef.current = selectedTargetKey;
    setSelectedForm(buildSelectedFormFromEntry(selectedEntry));
  }, [selectedEntry, selectedTargetKey]);

  useEffect(() => {
    const signature = getTerrainSignature(state.snapshot);
    if (lastTerrainSignatureRef.current === signature) return;
    lastTerrainSignatureRef.current = signature;
    setTerrainForm(buildTerrainDraftFromSnapshot(state.snapshot));
  }, [state.snapshot]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = String(event?.key ?? "");
      const code = String(event?.code ?? "");
      const isMainToggle = key === "1" || code === "Digit1" || code === "Numpad1";
      const isGmToggle = key === "5" || code === "Digit5" || code === "Numpad5";
      const isSpawnToggle = key === "2" || code === "Digit2" || code === "Numpad2";
      const isTerrainToggle = key === "3" || code === "Digit3" || code === "Numpad3";
      if (!isMainToggle && !isGmToggle && !isSpawnToggle && !isTerrainToggle) return;

      const target = event?.target;
      const tagName = String(target?.tagName ?? "").toLowerCase();
      const editable = Boolean(
        target?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      );
      if (editable) return;

      if (isMainToggle) {
        setMainPanelOpen((prev) => !prev);
      }
      if (isGmToggle) {
        setGmPanelOpen((prev) => !prev);
      }
      if (isSpawnToggle) {
        setSpawnPanelOpen((prev) => !prev);
      }
      if (isTerrainToggle) {
        setTerrainPanelOpen((prev) => !prev);
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  return (
    <>
      <EditorFpsBadge />
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          zIndex: 4000,
          padding: "8px 12px",
          borderRadius: 999,
          background: "rgba(244, 185, 66, 0.95)",
          color: "#18212a",
          fontWeight: 900,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          boxShadow: "0 12px 24px rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      >
        Scene Creator Live
      </div>
      <EditorCharacterLabel state={state} />
      <GmPanel
        open={gmPanelOpen}
        moveStep={gmMoveStep}
        onMoveStepChange={setGmMoveStep}
        characterVisible={gmCharacterVisible}
        onCharacterVisibleChange={setGmCharacterVisible}
      />
      <SpawnPanel
        open={spawnPanelOpen}
        actorDefs={actorDefs}
        objectDefs={objectDefs}
        spawnActorDefId={spawnActorDefId}
        onSpawnActorDefIdChange={setSpawnActorDefId}
        useCurrentPositionActor={useCurrentPositionActor}
        onUseCurrentPositionActorChange={setUseCurrentPositionActor}
        spawnActorPos={spawnActorPos}
        onSpawnActorPosChange={setSpawnActorPos}
        onSpawnActor={handleSpawnActor}
        spawnObjectDefId={spawnObjectDefId}
        onSpawnObjectDefIdChange={setSpawnObjectDefId}
        useCurrentPositionObject={useCurrentPositionObject}
        onUseCurrentPositionObjectChange={setUseCurrentPositionObject}
        spawnObjectPos={spawnObjectPos}
        onSpawnObjectPosChange={setSpawnObjectPos}
        onSpawnObject={handleSpawnObject}
        gmPanelOpen={gmPanelOpen}
      />
      <TerrainPanel
        open={terrainPanelOpen}
        snapshot={state.snapshot}
        terrainForm={terrainForm}
        onTerrainChange={handleTerrainChange}
        gmPanelOpen={gmPanelOpen}
        spawnPanelOpen={spawnPanelOpen}
      />
      <SelectedPanel
        selectedEntry={selectedEntry}
        selectedForm={selectedForm}
        onSelectedFormChange={handleSelectedFormChange}
        onSaveSelected={handleSaveSelected}
        onDisableSelected={handleDisableSelected}
        gmPanelOpen={gmPanelOpen}
        spawnPanelOpen={spawnPanelOpen}
        terrainPanelOpen={terrainPanelOpen}
      />
      <GameCanvas
        containerRef={state.containerRef}
        snapshot={state.snapshot}
        worldClock={state.editorMeta?.worldClock ?? state.snapshot?.worldClock ?? null}
        worldStoreRef={state.worldStoreRef}
        setSnapshot={state.setSnapshot}
        exposeRuntimeRef={state.runtimeRef}
        exposeCameraRef={state.cameraRef}
        exposeCameraApiRef={state.cameraApiRef}
        editorCameraFocusRef={state.editorCameraFocusRef}
        editorAnchorRef={state.editorAnchorRef}
        editorMoveSpeedRef={state.editorMoveSpeedRef}
        editorMoveStateRef={state.editorMoveStateRef}
        editorInputStateRef={state.editorInputStateRef}
        editorCharacterVisibleRef={state.editorCharacterVisibleRef}
        onEditorTick={handleEditorTick}
        disableSceneInput={true}
        buildPlacement={null}
        inventorySnapshot={null}
        onInputIntent={null}
        disableInput={true}
        onTargetSelect={handleTargetSelect}
        onTargetClear={handleTargetClear}
        selectedTarget={state.selectedTarget}
        allowObjectSelection={true}
        disableGroundMove={true}
        disableWorldEntities={true}
        cameraOptions={editorCameraOptions}
      />
      <SidePanel
        state={state}
        onLogout={handleLogoutClick}
        selectableTargets={selectableTargets}
        selectedTargetKey={selectedTargetKey}
        onSelectTarget={handleSelectTargetByKey}
        open={mainPanelOpen}
        position={mainPanelPosition}
        onDragPointerDown={handleMainPanelDragPointerDown}
      />
    </>
  );
}
