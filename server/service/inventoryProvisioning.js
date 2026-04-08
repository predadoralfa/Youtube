// server/service/inventoryProvisioning.js
"use strict";

const db = require("../models");

/**
 * ensureStarterInventory(userId, tx)
 *
 * Novo modelo (genérico):
 * - cria ga_container
 * - cria ga_container_owner (PLAYER)
 * - cria ga_container_slot (container_id)
 *
 * Regras:
 * - Sem GaUserContainer (legado)
 * - slot_role fica na tabela de ownership
 * - slots são 0-based
 *
 * OBS: HAND_L e HAND_R usam defs distintas (code = "HAND_L" / "HAND_R")
 * conforme seu seed atual.
 */
async function ensureStarterInventory(userIdRaw, tx) {
  const userId = String(userIdRaw);
  const queryOptions = tx ? { transaction: tx } : {};
  const lockOptions = tx ? { transaction: tx, lock: tx.LOCK.UPDATE } : {};

  async function getDefByCode(code) {
    const def = await db.GaContainerDef.findOne({
      where: { code },
      ...queryOptions,
      ...(tx ? { lock: tx.LOCK.SHARE } : {}),
    });

    if (!def) throw new Error(`Missing seed: ga_container_def code=${code}`);

    const slotCount = Number(def.slot_count || 0);
    if (!Number.isInteger(slotCount) || slotCount < 1) {
      throw new Error(`Invalid ga_container_def.slot_count for ${code}: ${def.slot_count}`);
    }

    return { def, slotCount };
  }

  async function ensureRole(slotRole, defCode) {
    const { def, slotCount } = await getDefByCode(defCode);

    // 1) ownership único por (PLAYER, userId, slotRole)
      let owner = await db.GaContainerOwner.findOne({
        where: { owner_kind: "PLAYER", owner_id: userId, slot_role: slotRole },
        ...lockOptions,
      });

    // 2) se não existir, cria container + owner
    if (!owner) {
      const container = await db.GaContainer.create(
        {
          container_def_id: def.id,
          state: "ACTIVE",
          rev: 1,
        },
        queryOptions
      );

      owner = await db.GaContainerOwner.create(
        {
          container_id: container.id,
          owner_kind: "PLAYER",
          owner_id: userId,
          slot_role: slotRole,
        },
        queryOptions
      );
    }

    const containerId = owner.container_id;

    // 3) garante slots vazios (idempotente)
    for (let i = 0; i < slotCount; i++) {
      await db.GaContainerSlot.findOrCreate({
        where: { container_id: containerId, slot_index: i },
        defaults: {
          container_id: containerId,
          slot_index: i,
          item_instance_id: null,
          qty: 0,
        },
        ...queryOptions,
      });
    }

    return owner;
  }

  // Defs distintas conforme seu seed:
  await ensureRole("HAND_L", "HAND_L");
  await ensureRole("HAND_R", "HAND_R");
}

module.exports = { ensureStarterInventory };
