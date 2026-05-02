import { useRef } from "react";
import { InventoryItemIcon } from "@/components/models/inventory/InventoryItemIcon";
import { formatDuration } from "../helpers/study";
import {
  formatRequirementCounts,
  formatResearchRequirementSummary,
  getRequirementCount,
} from "../helpers/requirements";
import { getRequirementLabel } from "../helpers/inventoryCounts";

function getTreeNodeKey(node, fallback = "") {
  return String(node?.code ?? node?.researchDefId ?? node?.id ?? fallback);
}

function ResearchTreeNode({
  node,
  inventoryIndex,
  onStartStudy,
  registerNodeRef,
  depth = 0,
  showChildren = true,
  childrenLayout = "stack",
}) {
  const isRunning = node?.isRunning === true;
  const isCompleted = node?.isCompleted === true;
  const isLocked = !isRunning && !isCompleted && node?.canStart !== true;
  const currentLevel = Number(node?.currentLevel ?? 0);
  const maxLevel = Number(node?.maxLevel ?? 1);
  const activeLevel = Number(node?.activeLevel ?? Math.min(currentLevel + 1, maxLevel));
  const buttonLabel = isCompleted
    ? "Completed"
    : isRunning
      ? "Studying..."
      : isLocked
        ? "Locked"
        : `Start Lv.${activeLevel}`;
  const stageLevel = Number(node?.currentLevel ?? 0);
  const requirements = Array.isArray(node?.levelItemCosts) ? node.levelItemCosts : [];
  const children = Array.isArray(node?.treeChildren) ? node.treeChildren : [];
  const requirementSummary = formatResearchRequirementSummary(node, inventoryIndex);
  const isPrimitiveShelter = String(node?.code ?? "").toUpperCase() === "RESEARCH_PRIMITIVE_SHELTER";
  const iconItemDef = node?.itemDef
    ? {
        ...node.itemDef,
        code: node.itemDef.code ?? node.code ?? "",
        name: node.itemDef.name ?? node.name ?? "",
        category: node.itemDef.category ?? "BUILD",
      }
    : {
        code: node?.code ?? "",
        name: node?.name ?? "",
        category: "BUILD",
      };

  return (
    <div className={`research-tree-node research-tree-node--depth-${depth}`} data-tree-node-key={getTreeNodeKey(node, depth)}>
      <article
        ref={registerNodeRef?.(getTreeNodeKey(node, depth))}
        className={`research-card research-card--${node.tone} ${isLocked ? "research-card--locked" : ""}`}
      >
        <div className="research-card-head">
          <div className={`research-icon-box ${isPrimitiveShelter ? "research-icon-box--large" : ""}`}>
            <InventoryItemIcon
              itemDef={iconItemDef}
              label={node.name}
              className={`research-item-icon ${isPrimitiveShelter ? "research-item-icon--large research-item-icon--shelter" : ""}`}
            />
          </div>
          <div className="research-head-copy">
            <span className="research-badge">{isCompleted ? "Mastered" : `Level ${stageLevel}`}</span>
            <h3>{node.name}</h3>
          </div>
        </div>

        <p>
          {node.nextLevelDescription ?? node.levelDescription ?? node.description}
          {requirementSummary ? (
            <>
              {" "}
              <span className="research-description-requirements">{requirementSummary}</span>
            </>
          ) : null}
        </p>

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
                  key={`${node.code ?? depth}-req-${costIndex}-${label}`}
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
          <span>
            Stage: {currentLevel}/{maxLevel}
          </span>
          <span>{isRunning ? "Running" : isCompleted ? "Completed" : `Time: ${formatDuration(node?.levelStudyTimeMs ?? 0)}`}</span>
        </div>

        <button
          type="button"
          className="research-action"
          disabled={!node?.canStart || isCompleted || isRunning}
          onClick={() => onStartStudy?.(node.code)}
        >
          {buttonLabel}
        </button>
      </article>

      {showChildren && children.length > 0 ? (
        <div
          className={`research-tree-children research-tree-children--depth-${depth} research-tree-children--${childrenLayout}`}
        >
          <div className="research-tree-children-stack">
            {children.map((child, childIndex) => (
              <ResearchTreeNode
                key={getTreeNodeKey(child, `${getTreeNodeKey(node, depth)}-child-${childIndex}`)}
                node={child}
                inventoryIndex={inventoryIndex}
                onStartStudy={onStartStudy}
                registerNodeRef={registerNodeRef}
                depth={depth + 1}
                childrenLayout={String(child?.code ?? "").toUpperCase() === "RESEARCH_STONE" ? "row" : "stack"}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ResearchBoard({
  boardRef,
  laneRef,
  zoom,
  contentSize,
  nodes,
  inventoryIndex,
  onStartStudy,
  onWheel,
  onMouseDown,
}) {
  const nodeRefs = useRef(new Map());

  const registerNodeRef = (key) => (el) => {
    if (el) {
      nodeRefs.current.set(key, el);
    } else {
      nodeRefs.current.delete(key);
    }
  };

  return (
    <div
      ref={boardRef}
      className="research-board"
      onContextMenu={(e) => e.preventDefault()}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
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
          className="research-lane research-lane--tree"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {nodes.map((node, index) => (
            <ResearchTreeNode
              key={node.code ?? node.researchDefId ?? index}
              node={node}
              inventoryIndex={inventoryIndex}
              onStartStudy={onStartStudy}
              registerNodeRef={registerNodeRef}
              childrenLayout={String(node?.code ?? "").toUpperCase() === "RESEARCH_STONE" ? "row" : "stack"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
