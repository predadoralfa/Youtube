import { canonicalItemCode, normalizeIdentity } from "./normalize";

export function createInventoryRegistry() {
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
    if (id && !defById.has(id)) defById.set(id, defLike);
    if (code && !defByCode.has(code)) defByCode.set(code, defLike);
    if (name && !defByName.has(name)) defByName.set(name, defLike);
  };

  const addCount = (defLike, qty) => {
    const amount = Math.max(0, Number(qty ?? 0));
    if (amount <= 0 || !defLike) return;
    const itemDefId =
      defLike.itemDefId != null
        ? String(defLike.itemDefId)
        : defLike.id != null
          ? String(defLike.id)
          : null;
    const code = defLike.code != null ? canonicalItemCode(defLike.code) : null;
    const name = defLike.name != null ? normalizeIdentity(defLike.name) : null;
    if (itemDefId) countsByDefId.set(itemDefId, (countsByDefId.get(itemDefId) ?? 0) + amount);
    if (code) countsByCode.set(code, (countsByCode.get(code) ?? 0) + amount);
    if (name) countsByName.set(name, (countsByName.get(name) ?? 0) + amount);
  };

  return {
    defById,
    defByCode,
    defByName,
    countsByDefId,
    countsByCode,
    countsByName,
    registerDef,
    addCount,
  };
}
