import { useMemo } from "react";
import { buildInventoryCounts } from "../../helpers/inventoryCounts";
import { deriveLiveStudy, resolveNodeTone } from "../../helpers/study";
import { buildStudyTree, flattenStudyTree } from "./tree";

export function useResearchModalDerivedState({
  snapshot,
  clientNowMs,
  inventorySnapshot,
  equipmentSnapshot,
}) {
  const nodes = useMemo(() => {
    const studies = Array.isArray(snapshot?.studies) ? snapshot.studies : [];
    const serverNowMs = Number(snapshot?.serverNowMs ?? Date.now());
    const decorated = studies.map((study) => {
      const live = deriveLiveStudy(study, serverNowMs, clientNowMs);
      return {
        ...study,
        tone: resolveNodeTone(study?.code),
        effectiveProgressMs: live.effectiveProgressMs,
        remainingMs: live.remainingMs,
        liveProgressRatio: live.progressRatio,
      };
    });
    return buildStudyTree(decorated);
  }, [clientNowMs, snapshot]);

  const inventoryIndex = useMemo(
    () => buildInventoryCounts(inventorySnapshot, equipmentSnapshot),
    [equipmentSnapshot, inventorySnapshot]
  );

  const activeStudy = useMemo(
    () => flattenStudyTree(nodes).find((node) => node?.isRunning) ?? null,
    [nodes]
  );
  const previewStudy = useMemo(
    () => activeStudy ?? flattenStudyTree(nodes).find((node) => node?.canStart) ?? nodes[0] ?? null,
    [activeStudy, nodes]
  );

  return {
    nodes,
    inventoryIndex,
    activeStudy,
    previewStudy,
  };
}
