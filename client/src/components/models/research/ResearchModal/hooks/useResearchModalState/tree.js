function normalizeStudyId(study) {
  return Number(study?.researchDefId ?? study?.id ?? 0) || null;
}

function buildStudyTree(studies) {
  const visibleStudies = Array.isArray(studies) ? studies.filter((study) => study?.isVisible !== false) : [];
  const byId = new Map(visibleStudies.map((study) => [normalizeStudyId(study), study]));
  const childrenByParentId = new Map();
  const roots = [];

  for (const study of visibleStudies) {
    const parentId = Number(study?.prerequisiteResearchDefId ?? 0) || null;
    const parent = parentId ? byId.get(parentId) ?? null : null;
    if (parent) {
      if (!childrenByParentId.has(parentId)) {
        childrenByParentId.set(parentId, []);
      }
      childrenByParentId.get(parentId).push(study);
    } else {
      roots.push(study);
    }
  }

  const sortStudies = (list) =>
    list.sort((a, b) => {
      const order = normalizeStudyId(a) - normalizeStudyId(b);
      if (order !== 0) return order;
      return String(a?.code ?? "").localeCompare(String(b?.code ?? ""));
    });

  sortStudies(roots);
  for (const children of childrenByParentId.values()) {
    sortStudies(children);
  }

  function attachTree(study, depth = 0) {
    const studyId = normalizeStudyId(study);
    const treeChildren = (childrenByParentId.get(studyId) ?? []).map((child) => attachTree(child, depth + 1));
    return {
      ...study,
      treeDepth: depth,
      treeChildren,
      treeHasChildren: treeChildren.length > 0,
    };
  }

  return roots.map((root) => attachTree(root, 0));
}

function flattenStudyTree(studies, output = []) {
  for (const study of Array.isArray(studies) ? studies : []) {
    output.push(study);
    if (Array.isArray(study?.treeChildren) && study.treeChildren.length > 0) {
      flattenStudyTree(study.treeChildren, output);
    }
  }
  return output;
}

export { buildStudyTree, flattenStudyTree };
