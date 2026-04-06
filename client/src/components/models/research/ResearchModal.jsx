import { useEffect, useMemo, useRef, useState } from "react";
import "@/style/researchModal.css";
import { InventoryItemIcon } from "@/components/models/inventory/InventoryItemIcon";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.45;
const DEFAULT_ZOOM = 1;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return `${hours}h ${restMinutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function resolveNodeTone(code) {
  const normalized = String(code ?? "").toUpperCase();
  if (normalized.includes("APPLE")) return "apple";
  if (normalized.includes("SHELTER")) return "shelter";
  return "stone";
}

function deriveLiveStudy(node, serverNowMs, clientNowMs) {
  const progressMs = Number(node?.progressMs ?? 0);
  const levelStudyTimeMs = Number(node?.levelStudyTimeMs ?? 0);
  const isRunning = node?.isRunning === true;
  const elapsedSincePayload = Math.max(0, Number(clientNowMs ?? 0) - Number(serverNowMs ?? 0));
  const effectiveProgressMs = isRunning
    ? Math.min(levelStudyTimeMs, progressMs + elapsedSincePayload)
    : progressMs;
  const remainingMs = Math.max(0, levelStudyTimeMs - effectiveProgressMs);
  const progressRatio = levelStudyTimeMs > 0 ? Math.max(0, Math.min(1, effectiveProgressMs / levelStudyTimeMs)) : 0;

  return {
    effectiveProgressMs,
    remainingMs,
    progressRatio,
  };
}

function normalizeIdentity(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_");
}

function canonicalItemCode(value) {
  const normalized = normalizeIdentity(value);
  if (
    normalized === "STONE" ||
    normalized === "SMALLSTONE" ||
    normalized === "SMALL_STONE" ||
    normalized === "MATERIALSTONE" ||
    normalized === "MATERIAL_STONE" ||
    normalized === "AMMO_SMALL_ROCK"
  ) {
    return "SMALL_STONE";
  }
  return normalized;
}

function buildInventoryCounts(inventorySnapshot, equipmentSnapshot) {
  const defById = new Map();
  const defByCode = new Map();
  const defByName = new Map();
  const countsByDefId = new Map();
  const countsByCode = new Map();
  const countsByName = new Map();

  const registerDef = (defLike) => {
    if (!defLike) return;
    const id = defLike.id != null ? String(defLike.id) : null;
    const code = defLike.code != null ? canonicalItemCode(defLike.code) : null;
    const name = defLike.name != null ? normalizeIdentity(defLike.name) : null;
    if (id && !defById.has(id)) {
      defById.set(id, defLike);
    }
    if (code && !defByCode.has(code)) {
      defByCode.set(code, defLike);
    }
    if (name && !defByName.has(name)) {
      defByName.set(name, defLike);
    }
  };

  const addCount = (defLike, qty) => {
    const amount = Math.max(0, Number(qty ?? 0));
    if (amount <= 0 || !defLike) return;

    const itemDefId = defLike.itemDefId != null ? String(defLike.itemDefId) : defLike.id != null ? String(defLike.id) : null;
    const code = defLike.code != null ? canonicalItemCode(defLike.code) : null;
    const name = defLike.name != null ? normalizeIdentity(defLike.name) : null;

    if (itemDefId) {
      countsByDefId.set(itemDefId, (countsByDefId.get(itemDefId) ?? 0) + amount);
    }

    if (code) {
      countsByCode.set(code, (countsByCode.get(code) ?? 0) + amount);
    }

    if (name) {
      countsByName.set(name, (countsByName.get(name) ?? 0) + amount);
    }
  };

  const inventorySource = inventorySnapshot?.inventory ?? inventorySnapshot ?? null;
  const inventoryDefs = Array.isArray(inventorySource?.itemDefs)
    ? inventorySource.itemDefs
    : Array.isArray(inventorySource?.item_defs)
      ? inventorySource.item_defs
      : [];
  const inventoryContainers = Array.isArray(inventorySource?.containers) ? inventorySource.containers : [];
  const inventoryInstances = Array.isArray(inventorySource?.itemInstances)
    ? inventorySource.itemInstances
    : Array.isArray(inventorySource?.item_instances)
      ? inventorySource.item_instances
      : [];

  for (const def of inventoryDefs) {
    registerDef(def);
  }

  for (const container of inventoryContainers) {
    for (const slot of Array.isArray(container?.slots) ? container.slots : []) {
      const qty = Math.max(0, Number(slot?.qty ?? 0));
      const itemInstanceId = slot?.itemInstanceId != null ? String(slot.itemInstanceId) : null;
      if (!itemInstanceId || qty <= 0) continue;

      const instance =
        inventoryInstances.find((entry) => String(entry?.id ?? entry?.itemInstanceId ?? entry?.item_instance_id ?? "") === itemInstanceId) ??
        null;
      const itemDefId =
        instance?.itemDefId != null
          ? String(instance.itemDefId)
          : instance?.item_def_id != null
            ? String(instance.item_def_id)
            : null;
      if (!itemDefId) continue;

      const def = defById.get(itemDefId) ?? null;
      const defLike = def ?? {
        id: itemDefId,
        itemDefId,
        code: instance?.code ?? instance?.itemCode ?? instance?.item_code ?? null,
        name: instance?.name ?? instance?.itemName ?? instance?.item_name ?? null,
      };

      registerDef(defLike);
      addCount(defLike, qty);
    }
  }

  const equipmentSources = [];
  const normalizedEquipmentSources = [
    equipmentSnapshot?.equipment ?? equipmentSnapshot ?? null,
    inventorySnapshot?.equipment ?? null,
  ].filter(Boolean);
  const seenSourceRefs = new Set();
  for (const source of normalizedEquipmentSources) {
    if (seenSourceRefs.has(source)) continue;
    seenSourceRefs.add(source);
    equipmentSources.push(source);
  }

  const countedEquipmentItemInstanceIds = new Set();

  for (const equipmentSource of equipmentSources) {
    const equipmentSlots = Array.isArray(equipmentSource?.slots) ? equipmentSource.slots : [];
    const equipmentInstances = Array.isArray(equipmentSource?.itemInstances)
      ? equipmentSource.itemInstances
      : Array.isArray(equipmentSource?.item_instances)
        ? equipmentSource.item_instances
        : [];
    const equipmentDefs = Array.isArray(equipmentSource?.itemDefs)
      ? equipmentSource.itemDefs
      : Array.isArray(equipmentSource?.item_defs)
        ? equipmentSource.item_defs
        : [];

    for (const def of equipmentDefs) {
      registerDef(def);
    }

    for (const slot of equipmentSlots) {
      const itemInstanceId = slot?.itemInstanceId != null ? String(slot.itemInstanceId) : null;
      if (itemInstanceId) {
        if (countedEquipmentItemInstanceIds.has(itemInstanceId)) continue;
        countedEquipmentItemInstanceIds.add(itemInstanceId);
      }

      const qty = Math.max(0, Number(slot?.qty ?? (itemInstanceId != null ? 1 : 0)));
      if (qty <= 0) continue;

      const slotItem = slot?.item ?? null;
      const itemDefId =
        slotItem?.itemDefId != null
          ? String(slotItem.itemDefId)
          : slotItem?.item_def_id != null
            ? String(slotItem.item_def_id)
            : null;
      const itemCode = slotItem?.code != null ? canonicalItemCode(slotItem.code) : null;
      const itemName = slotItem?.name != null ? String(slotItem.name) : null;

      let defLike =
        (itemDefId && defById.get(itemDefId)) ||
        (itemCode && defByCode.get(itemCode)) ||
        (itemName && defByName.get(normalizeIdentity(itemName))) ||
        null;

      if (!defLike && itemInstanceId != null) {
        const instance =
          equipmentInstances.find((entry) => String(entry?.id ?? entry?.itemInstanceId ?? entry?.item_instance_id ?? "") === itemInstanceId) ??
          inventoryInstances.find((entry) => String(entry?.id ?? entry?.itemInstanceId ?? entry?.item_instance_id ?? "") === itemInstanceId) ??
          null;
        const resolvedItemDefId =
          instance?.itemDefId != null
            ? String(instance.itemDefId)
            : instance?.item_def_id != null
              ? String(instance.item_def_id)
              : null;
        const resolvedCode = instance?.code != null ? canonicalItemCode(instance.code) : itemCode;
        const resolvedName = instance?.name ?? slotItem?.name ?? null;
        defLike =
          (resolvedItemDefId && defById.get(resolvedItemDefId)) ||
          (resolvedCode && defByCode.get(resolvedCode)) ||
          (resolvedName && defByName.get(normalizeIdentity(resolvedName))) ||
          {
            id: resolvedItemDefId ?? itemDefId ?? itemInstanceId,
            itemDefId: resolvedItemDefId ?? itemDefId ?? itemInstanceId,
            code: resolvedCode ?? itemCode ?? null,
            name: resolvedName,
          };
      }

      if (!defLike) continue;

      registerDef(defLike);
      addCount(defLike, qty);
    }
  }

  return {
    defById,
    defByCode,
    defByName,
    countsByDefId,
    countsByCode,
    countsByName,
  };
}

function formatRequirementCounts(have, need) {
  return `${Math.max(0, Number(have) || 0)} / ${Math.max(0, Number(need) || 0)}`;
}

function getRequirementLabel(cost, inventoryIndex) {
  if (!cost) return "Unknown";

  if (cost.itemDefId != null) {
    const def = inventoryIndex.defById.get(String(cost.itemDefId)) ?? null;
    if (def?.name) return def.name;
  }

  if (cost.itemCode != null) {
    const code = String(cost.itemCode).toUpperCase();
    const def = inventoryIndex.defByCode.get(code) ?? null;
    if (def?.name) return def.name;
    return code;
  }

  return "Unknown";
}

function getRequirementCount(cost, inventoryIndex) {
  if (!cost) return 0;

  if (cost.itemDefId != null) {
    const count = inventoryIndex.countsByDefId.get(String(cost.itemDefId));
    if (Number.isFinite(count)) return Number(count);
  }

  if (cost.itemCode != null) {
    const count = inventoryIndex.countsByCode.get(canonicalItemCode(cost.itemCode));
    if (Number.isFinite(count)) return Number(count);
  }

  if (cost.itemCode != null) {
    const countByName = inventoryIndex.countsByName.get(normalizeIdentity(canonicalItemCode(cost.itemCode)));
    if (Number.isFinite(countByName)) return Number(countByName);
  }

  return 0;
}

export function ResearchModal({
  open,
  snapshot,
  inventorySnapshot,
  equipmentSnapshot,
  researchMessage,
  onClose,
  onStartStudy,
  onRequestInventoryFull,
}) {
  const boardRef = useRef(null);
  const laneRef = useRef(null);
  const dragStateRef = useRef(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const targetZoomRef = useRef(DEFAULT_ZOOM);
  const zoomFrameRef = useRef(0);
  const [clientNowMs, setClientNowMs] = useState(() => Date.now());
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [contentSize, setContentSize] = useState({ width: 1160, height: 0 });

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    return () => {
      if (zoomFrameRef.current) {
        cancelAnimationFrame(zoomFrameRef.current);
        zoomFrameRef.current = 0;
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(() => {
      setClientNowMs(Date.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [open]);

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
  }, [open]);

  const nodes = useMemo(() => {
    const studies = Array.isArray(snapshot?.studies) ? snapshot.studies : [];
    const serverNowMs = Number(snapshot?.serverNowMs ?? Date.now());

    return studies.map((study) => {
      const live = deriveLiveStudy(study, serverNowMs, clientNowMs);
      return {
        ...study,
        tone: resolveNodeTone(study?.code),
        effectiveProgressMs: live.effectiveProgressMs,
        remainingMs: live.remainingMs,
        liveProgressRatio: live.progressRatio,
      };
    });
  }, [clientNowMs, snapshot]);

  const inventoryIndex = useMemo(
    () => buildInventoryCounts(inventorySnapshot, equipmentSnapshot),
    [equipmentSnapshot, inventorySnapshot]
  );

  const activeStudy = useMemo(
    () => nodes.find((node) => node?.isRunning) ?? null,
    [nodes]
  );

  const previewStudy = useMemo(
    () => activeStudy ?? nodes.find((node) => node?.canStart) ?? nodes[0] ?? null,
    [activeStudy, nodes]
  );

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
  }, [open, snapshot]);

  if (!open) return null;

  return (
    <div
      className="research-overlay"
      data-ui-block-game-input="true"
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="research-modal" onContextMenu={(e) => e.preventDefault()}>
        <div className="research-shell">
          <div className="research-topbar">
            <div className="research-topbar-main">
              <div className="research-topbar-copy">
                <p className="research-kicker">Research</p>
                <h2>Study Tree</h2>
                <p className="research-copy">
                  Each study unlocks what the character actually knows how to do with that material.
                </p>
              </div>

              <div className="research-global-progress">
                <div className="research-global-head">
                  <span>
                    {activeStudy
                      ? `${activeStudy.name} ${activeStudy.currentLevel}/${activeStudy.maxLevel}`
                      : "No active study"}
                  </span>
                  <strong>
                    {activeStudy ? `Remaining: ${formatDuration(activeStudy.remainingMs)}` : "Idle"}
                  </strong>
                </div>
                <div className="research-global-meter" aria-hidden="true">
                  <span
                    style={{
                      width: `${activeStudy ? activeStudy.liveProgressRatio * 100 : 0}%`,
                    }}
                  />
                </div>
                <p className="research-global-copy">
                  {previewStudy?.nextLevelDescription ??
                    previewStudy?.levelDescription ??
                    "Select or start a study to see what the next level unlocks."}
                </p>
              </div>
            </div>
            <button type="button" className="research-close" onClick={onClose}>
              Close
            </button>
          </div>

          <div
            ref={boardRef}
            className="research-board"
            onContextMenu={(e) => e.preventDefault()}
            onWheel={(e) => {
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

              if (zoomFrameRef.current) {
                cancelAnimationFrame(zoomFrameRef.current);
              }

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
            }}
            onMouseDown={(e) => {
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
            }}
          >
            <div className="research-pan-hint">Right click + drag to navigate the tree | Scroll to zoom</div>
            <div
              className="research-content"
              style={{
                width: `${contentSize.width * zoom}px`,
                height: `${contentSize.height * zoom}px`,
              }}
            >
              <div
                ref={laneRef}
                className="research-lane"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              >
                {nodes.map((node, index) => {
                  const isRunning = node?.isRunning === true;
                  const isCompleted = node?.isCompleted === true;
                  const currentLevel = Number(node?.currentLevel ?? 0);
                  const maxLevel = Number(node?.maxLevel ?? 1);
                  const activeLevel = Number(node?.activeLevel ?? Math.min(currentLevel + 1, maxLevel));
                  const buttonLabel = isCompleted
                    ? "Completed"
                    : isRunning
                      ? "Studying..."
                      : `Start Lv.${activeLevel}`;
                  const stageLevel = Number(node?.currentLevel ?? 0);
                  const requirements = Array.isArray(node?.levelItemCosts) ? node.levelItemCosts : [];

                  return (
                    <div key={node.code ?? node.researchDefId ?? index} className="research-row">
                      <article className={`research-card research-card--${node.tone}`}>
                        <div className="research-card-head">
                          <div className="research-icon-box">
                            <InventoryItemIcon
                              itemDef={node.itemDef}
                              label={node.name}
                              className="research-item-icon"
                            />
                          </div>
                          <div className="research-head-copy">
                            <span className="research-badge">
                              {isCompleted ? "Mastered" : `Level ${stageLevel}`}
                            </span>
                            <h3>{node.name}</h3>
                          </div>
                        </div>

                        <p>{node.nextLevelDescription ?? node.levelDescription ?? node.description}</p>

                        {requirements.length > 0 ? (
                          <div className="research-requirements">
                            <div className="research-requirements-title">Requirements</div>
                            {requirements.map((cost, costIndex) => {
                              const need = Number(cost?.qty ?? 0);
                              const have = getRequirementCount(cost, inventoryIndex);
                              const okRequirement = have >= need;
                              const label = getRequirementLabel(cost, inventoryIndex);

                              return (
                                <div
                                  key={`${node.code ?? index}-req-${costIndex}-${label}`}
                                  className={`research-requirement ${okRequirement ? "is-ready" : "is-missing"}`}
                                >
                                  <span className="research-requirement-label">{label}</span>
                                  <span className="research-requirement-count">
                                    <strong>{formatRequirementCounts(have, need)}</strong>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}

                        <div className="research-meta">
                          <span>Stage: {currentLevel}/{maxLevel}</span>
                          <span>{isRunning ? `Running` : isCompleted ? "Completed" : `Time: ${formatDuration(node?.levelStudyTimeMs ?? 0)}`}</span>
                        </div>

                        <button
                          type="button"
                          className="research-action"
                          disabled={!node?.canStart || isCompleted}
                          onClick={() => onStartStudy?.(node.code)}
                        >
                          {buttonLabel}
                        </button>
                      </article>

                      <div className="research-connector" aria-hidden="true">
                        <span className="research-line" />
                        <span className="research-dot" />
                        <span className="research-placeholder">
                          Next study
                          <small>future branch</small>
                        </span>
                      </div>

                      {index < nodes.length - 1 ? (
                        <div className="research-branch" aria-hidden="true" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="research-footer">
            <span>{researchMessage || "Shortcut: R"}</span>
            <span>Close: Esc</span>
          </div>
        </div>
      </div>
    </div>
  );
}
