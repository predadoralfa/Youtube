// server/state/inventory/persist/flush.js
const db = require("../../../models");
const { INV_ERR, invError } = require("../validate/errors");

async function lockContainersAndSlots(userId, containerIds, slotKeys, tx) {
  // trava containers
  await db.GaUserContainer.findAll({
    where: { id: containerIds, user_id: userId },
    transaction: tx,
    lock: tx.LOCK.UPDATE,
  });

  // trava slots
  if (slotKeys.length) {
    const or = slotKeys.map((k) => ({
      user_container_id: k.containerId,
      slot_index: k.slotIndex,
    }));
    await db.GaContainerSlot.findAll({
      where: { [db.Sequelize.Op.or]: or },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
  }
}

async function ensureNewInstance(invRt, needsNewInstance, tx) {
  if (!needsNewInstance) return null;

  // cria a nova instância copiando item_def_id da origem
  const fromId = String(needsNewInstance.fromInstanceId);
  const fromII = invRt.itemInstanceById.get(fromId);
  if (!fromII) throw invError(INV_ERR.NOT_OWNER, "source instance not found for split");

  const created = await db.GaItemInstance.create(
    {
      user_id: invRt.userId,
      item_def_id: fromII.itemDefId,
      props_json: fromII.props || null,
    },
    { transaction: tx }
  );

  const newId = String(created.id);

  // injeta no runtime
  invRt.itemInstanceById.set(newId, {
    id: newId,
    userId: String(invRt.userId),
    itemDefId: String(fromII.itemDefId),
    props: fromII.props || null,
  });

  return newId;
}

async function flush(invRt, result, tx) {
  const containerIds = Array.from(new Set(result.touchedContainers.map(String)));

  const slotKeys = result.touchedSlots.map((s) => ({
    containerId: String(s.containerId),
    slotIndex: Number(s.slotIndex),
  }));

  await lockContainersAndSlots(invRt.userId, containerIds, slotKeys, tx);

  // split: resolve __NEW__ placeholder
  let newInstanceId = null;
  if (result.needsNewInstance) {
    newInstanceId = await ensureNewInstance(invRt, result.needsNewInstance, tx);
  }

  // persiste slots tocados
  for (const touched of result.touchedSlots) {
    const cid = String(touched.containerId);
    const idx = Number(touched.slotIndex);
    const slot = touched.slot;

    const itemInstanceId =
      slot.itemInstanceId === "__NEW__" ? newInstanceId : slot.itemInstanceId;

    await db.GaContainerSlot.upsert(
      {
        user_container_id: cid,
        slot_index: idx,
        item_instance_id: itemInstanceId ? Number(itemInstanceId) : null,
        qty: itemInstanceId ? Number(slot.qty) : 0,
      },
      { transaction: tx }
    );

    // atualiza runtime com id real
    slot.itemInstanceId = itemInstanceId || null;
    slot.qty = itemInstanceId ? Number(slot.qty) : 0;
  }

  // bump rev no DB (mantenha rev em sync)
  await db.GaUserContainer.update(
    { rev: db.Sequelize.literal("rev + 1") },
    { where: { id: containerIds, user_id: invRt.userId }, transaction: tx }
  );

  return true;
}

module.exports = { flush };