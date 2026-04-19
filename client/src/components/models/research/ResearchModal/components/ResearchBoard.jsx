import { useRef } from "react";
import { InventoryItemIcon } from "@/components/models/inventory/InventoryItemIcon";
import { formatDuration } from "../helpers/study";
import {
  formatRequirementCounts,
  getRequirementCount,
  getRequirementLabel,
} from "../helpers/requirements";

function getTreeNodeKey(node, fallback = "") {
  return String(node?.code ?? node?.researchDefId ?? node?.id ?? fallback);
}

function ResearchTreeNode({ node, inventoryIndex, onStartStudy, registerNodeRef, depth = 0 }) {
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
  const children = Array.isArray(node?.treeChildren) ? node.treeChildren : [];

  return (
    <div className={`research-tree-node research-tree-node--depth-${depth}`} data-tree-node-key={getTreeNodeKey(node, depth)}>
      <article
        ref={registerNodeRef?.(getTreeNodeKey(node, depth))}
        className={`research-card research-card--${node.tone}`}
      >
        <div className="research-card-head">
          <div className="research-icon-box">
            <InventoryItemIcon itemDef={node.itemDef} label={node.name} className="research-item-icon" />
          </div>
          <div className="research-head-copy">
            <span className="research-badge">{isCompleted ? "Mastered" : `Level ${stageLevel}`}</span>
            <h3>{node.name}</h3>
          </div>
        </div>

        <p>{node.nextLevelDescription ?? node.levelDescription ?? node.description}</p>

        {node.isVisible === false ? (
          <div className="research-locked-note">Locked until the prerequisite research is complete.</div>
        ) : null}

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
          disabled={!node?.canStart || isCompleted || node?.isVisible === false}
          onClick={() => onStartStudy?.(node.code)}
        >
          {buttonLabel}
        </button>
      </article>

      {children.length > 0 ? (
        <div className={`research-tree-children research-tree-children--depth-${depth}`}>
          <div className="research-tree-children-stack">
            {children.map((child, childIndex) => (
              <ResearchTreeNode
                key={getTreeNodeKey(child, `${getTreeNodeKey(node, depth)}-child-${childIndex}`)}
                node={child}
                inventoryIndex={inventoryIndex}
                onStartStudy={onStartStudy}
                registerNodeRef={registerNodeRef}
                depth={depth + 1}
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
            />
          ))}
        </div>
      </div>
    </div>
  );
}
