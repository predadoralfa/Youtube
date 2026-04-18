import { useLayoutEffect, useMemo, useRef, useState } from "react";
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
  const [connectors, setConnectors] = useState([]);

  const treeEdges = useMemo(() => {
    const edges = [];
    const visit = (node) => {
      const parentKey = getTreeNodeKey(node);
      const children = Array.isArray(node?.treeChildren) ? node.treeChildren : [];
      for (const child of children) {
        const childKey = getTreeNodeKey(child);
        edges.push({ from: parentKey, to: childKey });
        visit(child);
      }
    };
    for (const node of Array.isArray(nodes) ? nodes : []) {
      visit(node);
    }
    return edges;
  }, [nodes]);

  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      const laneEl = laneRef?.current;
      if (!laneEl) {
        setConnectors([]);
        return;
      }

      const laneRect = laneEl.getBoundingClientRect();
      const nextConnectors = [];

      for (const edge of treeEdges) {
        const fromEl = nodeRefs.current.get(edge.from);
        const toEl = nodeRefs.current.get(edge.to);
        if (!fromEl || !toEl) continue;

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const scale = zoom || 1;
        const startX = (fromRect.right - laneRect.left) / scale;
        const startY = (fromRect.top + fromRect.height * 0.5 - laneRect.top) / scale;
        const endX = (toRect.left - laneRect.left) / scale;
        const endY = (toRect.top + toRect.height * 0.5 - laneRect.top) / scale;
        const bend = Math.max(84, Math.abs(endX - startX) * 0.55);
        const controlX1 = startX + bend;
        const controlX2 = Math.max(startX + bend * 0.35, endX - bend * 0.35);
        const d = `M ${startX.toFixed(2)} ${startY.toFixed(2)} C ${controlX1.toFixed(2)} ${startY.toFixed(2)} ${controlX2.toFixed(2)} ${endY.toFixed(2)} ${endX.toFixed(2)} ${endY.toFixed(2)}`;

        nextConnectors.push({
          d,
          key: `${edge.from}->${edge.to}`,
        });
      }

      setConnectors(nextConnectors);
    };

    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(measure);
    });

    const laneEl = laneRef?.current;
    const resizeObserver = laneEl ? new ResizeObserver(() => measure()) : null;
    if (resizeObserver && laneEl) {
      resizeObserver.observe(laneEl);
    }

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [laneRef, treeEdges, zoom, contentSize.width, contentSize.height]);

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
          <svg
            className="research-graph-lines"
            width={contentSize.width}
            height={contentSize.height}
            viewBox={`0 0 ${contentSize.width} ${contentSize.height}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <filter id="researchRoadGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.3" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="
                    1 0 0 0 0.3
                    0 1 0 0 0.2
                    0 0 1 0 0
                    0 0 0 0.55 0"
                />
              </filter>
            </defs>
            <g className="research-graph-lines-group">
              {connectors.map((connector) => (
                <g key={connector.key} className="research-graph-line">
                  <path d={connector.d} className="research-graph-line-glow" />
                  <path d={connector.d} className="research-graph-line-main" />
                  <path d={connector.d} className="research-graph-line-core" />
                </g>
              ))}
            </g>
          </svg>
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
