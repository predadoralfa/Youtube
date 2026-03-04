// server/service/actorPickupService.js
"use strict";

const db = require("../models");
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { buildInventoryFull } = require("../state/inventory/fullPayload");

async function pickupFromChestToHands(userIdRaw, actorIdRaw) {
  const userId = String(userIdRaw);
  const actorId = Number(actorIdRaw);

  return await db.sequelize.transaction(async (tx) => {
    // 1) resolve containers do actor (LOOT)
    const owner = await db.GaContainerOwner.findOne({
      where: { owner_kind: "ACTOR", owner_id: actorId, slot_role: "LOOT" },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!owner) return { ok: false, error: { code: "CHEST_NO_LOOT_CONTAINER" } };

    const lootContainerId = Number(owner.container_id);

    // 2) pega primeiro slot com item
    const srcSlot = await db.GaContainerSlot.findOne({
      where: { container_id: lootContainerId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
      order: [["slot_index", "ASC"]],
    });

    // precisa varrer para achar item != null
    const srcSlots = await db.GaContainerSlot.findAll({
      where: { container_id: lootContainerId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
      order: [["slot_index", "ASC"]],
    });

    const src = srcSlots.find((s) => s.item_instance_id != null && Number(s.qty || 0) > 0);
    if (!src) return { ok: false, error: { code: "CHEST_EMPTY" } };

    // 3) resolve containers das mãos do player
    const handOwners = await db.GaContainerOwner.findAll({
      where: { owner_kind: "PLAYER", owner_id: userId, slot_role: ["HAND_R", "HAND_L"] },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
      order: [["slot_role", "ASC"]],
    });

    const byRole = new Map(handOwners.map((o) => [o.slot_role, Number(o.container_id)]));
    const handR = byRole.get("HAND_R");
    const handL = byRole.get("HAND_L");
    if (!handR || !handL) return { ok: false, error: { code: "HANDS_NOT_PROVISIONED" } };

    // 4) achar slot vazio em HAND_R, senão HAND_L
    async function firstEmptySlot(containerId) {
      const slots = await db.GaContainerSlot.findAll({
        where: { container_id: containerId },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
        order: [["slot_index", "ASC"]],
      });
      return slots.find((s) => s.item_instance_id == null);
    }

    let dst = await firstEmptySlot(handR);
    if (!dst) dst = await firstEmptySlot(handL);
    if (!dst) return { ok: false, error: { code: "INVENTORY_FULL" } };

    // 5) transfer (1 stack inteira por enquanto)
    dst.item_instance_id = src.item_instance_id;
    dst.qty = src.qty;

    src.item_instance_id = null;
    src.qty = 0;

    await Promise.all([src.save({ transaction: tx }), dst.save({ transaction: tx })]);

    // 6) bump rev dos containers envolvidos
    await db.GaContainer.increment({ rev: 1 }, { where: { id: [lootContainerId, dst.container_id] }, transaction: tx });

    // 7) rebuild full inventory do player (baseline)
    const invRt = await ensureInventoryLoaded(userId); // se isso usa tx, passe tx (recomendado)
    const inventoryFull = buildInventoryFull(invRt);

    return { ok: true, inventoryFull };
  });
}

module.exports = { pickupFromChestToHands };