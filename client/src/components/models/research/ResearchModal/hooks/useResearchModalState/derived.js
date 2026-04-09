import { useMemo } from "react";
import { buildInventoryCounts } from "../../helpers/inventoryCounts";
import { deriveLiveStudy, resolveNodeTone } from "../../helpers/study";

export function useResearchModalDerivedState({
  snapshot,
  clientNowMs,
  inventorySnapshot,
  equipmentSnapshot,
}) {
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

  return {
    nodes,
    inventoryIndex,
    activeStudy,
    previewStudy,
  };
}
