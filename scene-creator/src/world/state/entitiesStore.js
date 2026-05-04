export function createEntitiesStore() {
  let snapshot = [];
  let selfId = null;

  return {
    get selfId() {
      return selfId;
    },
    set selfId(value) {
      selfId = value;
    },
    getSnapshot() {
      return snapshot;
    },
    setSnapshot(nextSnapshot) {
      snapshot = Array.isArray(nextSnapshot) ? nextSnapshot : [];
    },
    clear() {
      snapshot = [];
    },
  };
}
