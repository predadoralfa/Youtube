"use strict";

const db = require("../models");
const { ensureActorContainer } = require("./actorService");

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function findSystemOwnerUserId(tx) {
  const row = await db.GaUser.findOne({
    attributes: ["id"],
    order: [["id", "ASC"]],
    transaction: tx,
    lock: tx?.LOCK?.SHARE,
  });

  return row?.id == null ? null : Number(row.id);
}

async function findReusableResourceItemInstance({ actorId, itemDefId, tx }) {
  const [rows] = await db.sequelize.query(
    `
    SELECT ii.id, ii.item_def_id, ii.owner_user_id, ii.bind_state, ii.durability, ii.props_json
    FROM ga_item_instance ii
    LEFT JOIN ga_container_slot cs ON cs.item_instance_id = ii.id
    LEFT JOIN ga_equipped_item ei ON ei.item_instance_id = ii.id
    WHERE ii.item_def_id = :itemDefId
      AND CAST(JSON_UNQUOTE(JSON_EXTRACT(ii.props_json, '$.sourceActorId')) AS UNSIGNED) = :actorId
      AND cs.item_instance_id IS NULL
      AND ei.item_instance_id IS NULL
    ORDER BY ii.id DESC
    LIMIT 1
    `,
    {
      replacements: {
        actorId: Number(actorId),
        itemDefId: Number(itemDefId),
      },
      transaction: tx,
    }
  );

  return rows?.[0] ?? null;
}

async function ensureResourceState({ actorId, ruleId, currentQty, nowMs, intervalMs, tx }) {
  const lastRefillAt = new Date(nowMs);
  const nextRefillAt = new Date(nowMs + intervalMs);

  const [state, created] = await db.GaActorResourceState.findOrCreate({
    where: { actor_id: Number(actorId) },
    defaults: {
      actor_id: Number(actorId),
      rule_def_id: Number(ruleId),
      current_qty: Number(currentQty),
      last_refill_at: lastRefillAt,
      next_refill_at: nextRefillAt,
      state: "ACTIVE",
      rev: 1,
    },
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  if (!created) {
    const nextState = String(state.state ?? "ACTIVE").toUpperCase();
    const nextCurrentQty = Number(currentQty);
    const nextLastRefillAt = state.last_refill_at ?? lastRefillAt;
    const nextNextRefillAt = state.next_refill_at ?? nextRefillAt;

    if (
      Number(state.rule_def_id) !== Number(ruleId) ||
      Number(state.current_qty ?? 0) !== nextCurrentQty ||
      nextState !== "ACTIVE"
    ) {
      await state.update(
        {
          rule_def_id: Number(ruleId),
          current_qty: nextCurrentQty,
          last_refill_at: nextLastRefillAt,
          next_refill_at: nextNextRefillAt,
          state: "ACTIVE",
        },
        { transaction: tx }
      );
    }
  }

  return state;
}

function buildLootSummaryFromSlot(slot, itemInstance, itemDef) {
  if (!slot || !itemInstance || !itemDef || Number(slot.qty ?? 0) <= 0) {
    return null;
  }

  const itemSummary = {
    itemInstanceId: Number(itemInstance.id),
    itemDefId: Number(itemInstance.item_def_id),
    code: itemDef?.code ?? null,
    name: itemDef?.name ?? itemDef?.code ?? `Item ${itemInstance.item_def_id}`,
    category: itemDef?.category ?? null,
    qty: Number(slot.qty ?? 0),
    slotIndex: Number(slot.slot_index ?? 0),
  };

  return {
    items: [itemSummary],
    totalQty: itemSummary.qty,
    primaryItem: itemSummary,
  };
}

function buildActorUpdatePayload(actor, lootSummary, resourceState) {
  const actorDef = actor.actorDef ?? null;
  const spawn = actor.spawn ?? null;

  return {
    id: String(actor.id),
    actorType: actorDef?.code ?? null,
    actorDefCode: actorDef?.code ?? null,
    actorKind: actorDef?.actor_kind ?? null,
    displayName: actorDef?.name ?? actorDef?.code ?? `Actor ${actor.id}`,
    instanceId: Number(actor.instance_id),
    spawnId: actor.actor_spawn_id == null ? null : Number(actor.actor_spawn_id),
    pos: {
      x: toFiniteNumber(actor.pos_x, 0),
      y: toFiniteNumber(actor.pos_y, 0),
      z: toFiniteNumber(actor.pos_z, 0),
    },
    status: actor.status,
    rev: Number(actor.rev ?? 0),
    visualHint: actorDef?.visual_hint ?? null,
    state: {
      ...(parseMaybeJsonObject(actorDef?.default_state_json ?? null) || {}),
      ...(parseMaybeJsonObject(spawn?.state_override_json ?? null) || {}),
      ...(parseMaybeJsonObject(actor.state_json ?? null) || {}),
      resourceRegen: {
        actorId: String(actor.id),
        ruleDefId: resourceState?.rule_def_id != null ? Number(resourceState.rule_def_id) : null,
        currentQty: resourceState?.current_qty != null ? Number(resourceState.current_qty) : null,
        lastRefillAt: resourceState?.last_refill_at ?? null,
        nextRefillAt: resourceState?.next_refill_at ?? null,
      },
    },
    containers: [],
    lootSummary: lootSummary ?? null,
  };
}

async function emitActorUpdate(io, actor, lootSummary, resourceState) {
  if (!io) return;
  const payload = {
    actorId: String(actor.id),
    actor: buildActorUpdatePayload(actor, lootSummary, resourceState),
  };

  io.to(`inst:${Number(actor.instance_id)}`).emit("actor:updated", payload);
}

async function processActorResourceRule(actor, rule, nowMs, io, tx) {
  const actorDef = actor.actorDef ?? null;
  const containerDefId = Number(actorDef?.default_container_def_id ?? 0);
  if (!Number.isInteger(containerDefId) || containerDefId <= 0) return { changed: false };

  const slotRole = String(rule.container_slot_role ?? "LOOT").trim() || "LOOT";

  await ensureActorContainer(
    {
      actorId: Number(actor.id),
      containerDefId,
      slotRole,
    },
    tx
  );

  const ownerRow = await db.GaContainerOwner.findOne({
    where: {
      owner_kind: "ACTOR",
      owner_id: Number(actor.id),
      slot_role: slotRole,
    },
    include: {
      association: "container",
      required: true,
    },
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  const container = ownerRow?.container ?? null;
  if (!container) return { changed: false };

  const slots = await db.GaContainerSlot.findAll({
    where: { container_id: Number(container.id) },
    order: [["slot_index", "ASC"]],
    transaction: tx,
    lock: tx?.LOCK?.UPDATE,
  });

  const itemDefId = Number(rule.item_def_id);
  const itemInstancesById = new Map();
  const itemInstanceIds = slots
    .map((slot) => slot.item_instance_id)
    .filter((id) => id != null)
    .map((id) => Number(id));

  if (itemInstanceIds.length > 0) {
    const itemRows = await db.GaItemInstance.findAll({
      where: { id: itemInstanceIds },
      transaction: tx,
      lock: tx?.LOCK?.UPDATE,
    });
    for (const row of itemRows) {
      itemInstancesById.set(Number(row.id), row);
    }
  }

  const itemDef = await db.GaItemDef.findByPk(itemDefId, { transaction: tx });
  if (!itemDef) return { changed: false };

  let sourceSlot = slots.find((slot) => {
    if (slot.item_instance_id == null) return false;
    const inst = itemInstancesById.get(Number(slot.item_instance_id));
    return inst && Number(inst.item_def_id) === itemDefId && Number(slot.qty ?? 0) > 0;
  }) ?? null;

  const currentQty = sourceSlot ? Number(sourceSlot.qty ?? 0) : 0;
  const resourceState = await ensureResourceState({
    actorId: Number(actor.id),
    ruleId: Number(rule.id),
    currentQty,
    nowMs,
    intervalMs: Number(rule.refill_interval_ms ?? 300000),
    tx,
  });

  const nextRefillAtMs = resourceState?.next_refill_at ? new Date(resourceState.next_refill_at).getTime() : 0;
  const due = nowMs >= nextRefillAtMs;
  const maxQty = Number(rule.max_qty ?? 15);
  const refillAmount = Number(rule.refill_amount ?? 1);
  const missingQty = Math.max(0, maxQty - currentQty);

  let changed = false;
  let newQty = currentQty;
  let effectiveItemInstance = null;

  if (due && missingQty > 0) {
    const amountToAdd = Math.min(refillAmount, missingQty);
    let targetSlot = sourceSlot;

    if (!targetSlot) {
      targetSlot = slots.find((slot) => slot.item_instance_id == null) ?? null;
    }

    if (targetSlot) {
      let itemInstance = null;
      if (targetSlot.item_instance_id != null) {
        itemInstance = itemInstancesById.get(Number(targetSlot.item_instance_id)) ?? null;
      }

      if (!itemInstance) {
        const reusable = await findReusableResourceItemInstance({
          actorId: Number(actor.id),
          itemDefId,
          tx,
        });

        if (reusable) {
          itemInstance = reusable;
        } else {
          const systemOwnerUserId = await findSystemOwnerUserId(tx);
          if (!systemOwnerUserId) {
            throw new Error("[RESOURCE_REGEN] no system owner user available");
          }

          itemInstance = await db.GaItemInstance.create(
            {
              item_def_id: itemDefId,
              owner_user_id: systemOwnerUserId,
              bind_state: "NONE",
              durability: null,
              props_json: {
                sourceActorId: Number(actor.id),
                sourceType: actorDef?.code ?? "RESOURCE_NODE",
                resourceRegen: true,
              },
            },
            { transaction: tx }
          );
        }

        targetSlot.item_instance_id = Number(itemInstance.id);
      }

      effectiveItemInstance = itemInstance;

      targetSlot.qty = Number(targetSlot.qty ?? 0) + amountToAdd;
      newQty = Number(targetSlot.qty ?? 0);
      changed = amountToAdd > 0;

      await db.GaContainerSlot.update(
        {
          item_instance_id: targetSlot.item_instance_id,
          qty: targetSlot.qty,
        },
        {
          where: {
            container_id: Number(container.id),
            slot_index: Number(targetSlot.slot_index),
          },
          transaction: tx,
        }
      );

      await db.GaContainer.increment(
        { rev: 1 },
        {
          where: { id: Number(container.id) },
          transaction: tx,
        }
      );

      const nextLastRefillAt = new Date(nowMs);
      const nextNextRefillAt = new Date(nowMs + Number(rule.refill_interval_ms ?? 300000));
      await resourceState.update(
        {
          current_qty: newQty,
          last_refill_at: nextLastRefillAt,
          next_refill_at: nextNextRefillAt,
          state: "ACTIVE",
        },
        { transaction: tx }
      );
    } else {
      await resourceState.update(
        {
          current_qty: currentQty,
          next_refill_at: new Date(nowMs + Number(rule.refill_interval_ms ?? 300000)),
          state: "ACTIVE",
        },
        { transaction: tx }
      );
    }
  } else if (Number(resourceState.current_qty ?? -1) !== currentQty) {
    await resourceState.update(
      {
        current_qty: currentQty,
        state: "ACTIVE",
      },
      { transaction: tx }
    );
  }

  const refreshedSlots = slots.map((slot) => ({
    slotIndex: Number(slot.slot_index),
    itemInstanceId: slot.item_instance_id == null ? null : Number(slot.item_instance_id),
    qty: Number(slot.qty ?? 0),
  }));

  const refreshedTargetSlot = refreshedSlots.find((slot) => slot.qty > 0) ?? null;
  let lootSummary = null;
  const activeItemInstance =
    effectiveItemInstance ??
    (refreshedTargetSlot?.itemInstanceId != null
      ? itemInstancesById.get(Number(refreshedTargetSlot.itemInstanceId)) ?? null
      : null);

  if (activeItemInstance && refreshedTargetSlot?.qty > 0) {
    lootSummary = {
      items: [
        {
          itemInstanceId: Number(activeItemInstance.id),
          itemDefId: Number(activeItemInstance.item_def_id),
          code: itemDef.code ?? null,
          name: itemDef.name ?? itemDef.code ?? `Item ${itemDefId}`,
          category: itemDef.category ?? null,
          qty: refreshedTargetSlot.qty,
          slotIndex: refreshedTargetSlot.slotIndex,
        },
      ],
      totalQty: refreshedTargetSlot.qty,
      primaryItem: {
        itemInstanceId: Number(activeItemInstance.id),
        itemDefId: Number(activeItemInstance.item_def_id),
        code: itemDef.code ?? null,
        name: itemDef.name ?? itemDef.code ?? `Item ${itemDefId}`,
        category: itemDef.category ?? null,
        qty: refreshedTargetSlot.qty,
        slotIndex: refreshedTargetSlot.slotIndex,
      },
    };
  }

  return {
    changed,
    actorUpdate: changed ? buildActorUpdatePayload(actor, lootSummary, resourceState) : null,
    lootSummary,
    resourceState,
    currentQty: newQty,
  };
}

async function processActorResourceRegenTick(io, nowMsValue) {
  const nowMs = Number.isFinite(Number(nowMsValue)) ? Number(nowMsValue) : Date.now();
  const activeRules = await db.GaActorResourceRuleDef.findAll({
    where: { is_active: true },
    include: [
      {
        association: "actorDef",
        required: true,
        where: { is_active: true },
      },
      {
        association: "itemDef",
        required: true,
        where: { is_active: true },
      },
    ],
    order: [["id", "ASC"]],
  });

  if (!activeRules.length) {
    return { changed: false, processed: 0 };
  }

  let changed = false;
  let processed = 0;

  for (const rule of activeRules) {
    const actorRows = await db.GaActor.findAll({
      where: {
        actor_def_id: Number(rule.actor_def_id),
        status: "ACTIVE",
      },
      include: [
        {
          association: "actorDef",
          required: true,
        },
        {
          association: "spawn",
          required: false,
        },
      ],
      order: [["id", "ASC"]],
    });

    for (const actor of actorRows) {
      processed += 1;

      const result = await db.sequelize.transaction(async (tx) => {
        const lockedActor = await db.GaActor.findByPk(actor.id, {
          include: [
            {
              association: "actorDef",
              required: true,
            },
            {
              association: "spawn",
              required: false,
            },
          ],
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });

        if (!lockedActor || String(lockedActor.status) !== "ACTIVE") {
          return { changed: false, actorUpdate: null };
        }

        return await processActorResourceRule(lockedActor, rule, nowMs, io, tx);
      });

      if (result?.changed) {
        changed = true;
        if (io && result.actorUpdate?.instanceId != null) {
          await emitActorUpdate(io, {
            id: actor.id,
            instance_id: actor.instance_id,
            actorDef: actor.actorDef,
            actor_spawn_id: actor.actor_spawn_id,
            pos_x: actor.pos_x,
            pos_y: actor.pos_y,
            pos_z: actor.pos_z,
            status: actor.status,
            rev: actor.rev,
            state_json: actor.state_json,
            spawn: actor.spawn,
          }, result.actorUpdate.lootSummary, result.resourceState);
        }
      }
    }
  }

  return { changed, processed };
}

module.exports = {
  processActorResourceRegenTick,
};
