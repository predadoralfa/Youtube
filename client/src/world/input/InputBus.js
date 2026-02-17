export function createInputBus() {
  const listeners = new Set();

  return {
    emit(intent) {
      for (const fn of listeners) fn(intent);
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    clear() {
      listeners.clear();
    },
  };
}
