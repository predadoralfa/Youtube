import Stats from "three/examples/jsm/libs/stats.module.js";

const STATS_MARKER = "game-canvas-stats-panel";

function shouldShowStats() {
  const flag = String(import.meta.env?.VITE_SHOW_STATS ?? "").trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return Boolean(import.meta.env.DEV);
}

export function createStatsPanel(container = null) {
  if (!shouldShowStats()) {
    return {
      stats: null,
      dispose: () => {},
    };
  }

  const stats = new Stats();
  const target = container && container.ownerDocument ? container : document.body;

  const existing = target.querySelector?.(`[data-debug-panel="${STATS_MARKER}"]`);
  if (existing?.parentNode) {
    existing.parentNode.removeChild(existing);
  }

  stats.dom.dataset.debugPanel = STATS_MARKER;
  stats.dom.style.position = "fixed";
  stats.dom.style.left = "0";
  stats.dom.style.right = "auto";
  stats.dom.style.top = "0";
  stats.dom.style.zIndex = "9999";
  stats.dom.style.pointerEvents = "none";

  target.appendChild(stats.dom);

  return {
    stats,
    dispose: () => {
      const node = stats?.dom ?? null;
      if (node?.parentNode) {
        node.parentNode.removeChild(node);
      }
    },
  };
}
