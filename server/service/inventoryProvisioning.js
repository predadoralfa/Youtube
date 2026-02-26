// server/service/inventoryProvisioning.js
const db = require("../models");

async function ensureStarterInventory(userId, tx) {
  // container def obrigatório
  const def = await db.GaContainerDef.findOne({
    where: { code: "HAND_1S" },
    transaction: tx,
  });

  if (!def) {
    throw new Error("Missing seed: ga_container_def code=HAND_1S");
  }

  // HAND_L e HAND_R únicos por user
  async function ensureRole(role) {
    const [uc] = await db.GaUserContainer.findOrCreate({
      where: { user_id: userId, role },
      defaults: {
        user_id: userId,
        role,
        container_def_id: def.id,
        state: "ACTIVE",
        rev: 0,
      },
      transaction: tx,
    });

    // garante slots vazios
    const slotCount = Number(def.slot_count || 0);
    for (let i = 0; i < slotCount; i++) {
      await db.GaContainerSlot.findOrCreate({
        where: { user_container_id: uc.id, slot_index: i },
        defaults: {
          user_container_id: uc.id,
          slot_index: i,
          item_instance_id: null,
          qty: 0,
        },
        transaction: tx,
      });
    }

    return uc;
  }

  await ensureRole("HAND_L");
  await ensureRole("HAND_R");
}

module.exports = { ensureStarterInventory };