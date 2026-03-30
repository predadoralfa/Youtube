// server/state/inventory/validate/errors.js
const INV_ERR = {
  SLOT_OOB: "SLOT_OOB",
  CONTAINER_NOT_FOUND: "CONTAINER_NOT_FOUND",
  CONTAINER_DISABLED: "CONTAINER_DISABLED",
  EMPTY_SOURCE: "EMPTY_SOURCE",
  DEST_NOT_EMPTY: "DEST_NOT_EMPTY",
  NOT_SAME_ITEM: "NOT_SAME_ITEM",
  NOT_STACKABLE: "NOT_STACKABLE",
  STACK_OVERFLOW: "STACK_OVERFLOW",
  INVALID_QTY: "INVALID_QTY",
  NOT_OWNER: "NOT_OWNER",
  HELD_STATE_ACTIVE: "HELD_STATE_ACTIVE",
  NO_HELD_STATE: "NO_HELD_STATE",
  CONCURRENT_STATE_CHANGED: "CONCURRENT_STATE_CHANGED",
  ITEM_INSTANCE_NOT_FOUND: "ITEM_INSTANCE_NOT_FOUND",
};

function invError(code, message, meta) {
  const err = new Error(message || code);
  err.code = code;
  if (meta) err.meta = meta;
  return err;
}

module.exports = { INV_ERR, invError };
