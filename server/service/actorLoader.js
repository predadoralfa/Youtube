"use strict";

const db = require("../models");
const { createRuntimeActor, ensureActorContainer } = require("./actorService");

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mergeStateParts(...parts) {
  return parts.reduce((acc, part) => {
    const value = parseMaybeJsonObject(part);
    if (!value || typeof value !== "object" || Array.isArray(value)) return acc;
    return { ...acc, ...value };
  }, {});
}

async function ensureRuntimeActorsForSpawns(instanceId, tx) {
  const spawnRows = await db.GaActorSpawn.findAll({
    where: {
      instance_id: instanceId,
      is_active: true,
    },
    include: [
      {
        association: "actorDef",
        required: true,
        where: { is_active: true },
      },
    ],
    order: [["id", "ASC"]],
    transaction: tx,
  });

  if (spawnRows.length === 0) return;

  const spawnIds = spawnRows.map((row) => Number(row.id));
  const runtimeRows = await db.GaActor.findAll({
    where: {
      instance_id: instanceId,
      actor_spawn_id: spawnIds,
    },
    transaction: tx,
  });

  const runtimeBySpawnId = new Map(
    runtimeRows
      .filter((row) => row.actor_spawn_id != null)
      .map((row) => [Number(row.actor_spawn_id), row])
  );

  for (const spawn of spawnRows) {
    const actorDef = spawn.actorDef;
    let runtime = runtimeBySpawnId.get(Number(spawn.id)) ?? null;

    if (!runtime) {
      const stateJson = mergeStateParts(
        actorDef?.default_state_json ?? null,
        spawn.state_override_json ?? null
      );

      const created = await createRuntimeActor(
        {
          actorDefId: actorDef.id,
          actorSpawnId: spawn.id,
          instanceId,
          posX: spawn.pos_x,
          posY: spawn.pos_y,
          posZ: spawn.pos_z,
          stateJson: Object.keys(stateJson).length > 0 ? stateJson : null,
          status: "ACTIVE",
          rev: Number(spawn.rev ?? 1),
          transaction: tx,
        }
      );

      runtime = created.actor;
      runtimeBySpawnId.set(Number(spawn.id), runtime);
    }

    const defaultContainerDefId = Number(actorDef?.default_container_def_id ?? 0);
    if (defaultContainerDefId > 0) {
      await ensureActorContainer(
        {
          actorId: runtime.id,
          containerDefId: defaultContainerDefId,
          slotRole: "LOOT",
        },
        tx
      );
    }
  }
}

function buildActorPayload(actorRow) {
  const actor = actorRow.get({ plain: true });
  const actorDef = actor.actorDef ?? null;
  const spawn = actor.spawn ?? null;
  const mergedState = mergeStateParts(
    actorDef?.default_state_json ?? null,
    spawn?.state_override_json ?? null,
    actor.state_json ?? null
  );

  return {
    id: Number(actor.id),
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
    state: Object.keys(mergedState).length > 0 ? mergedState : null,
    containers: [],
    lootSummary: null,
  };
}

async function attachContainersAndLoot(actors, tx) {
  if (actors.length === 0) return actors;

  const actorIds = actors.map((actor) => actor.id);
  const ownerRows = await db.GaContainerOwner.findAll({
    where: {
      owner_kind: "ACTOR",
      owner_id: actorIds,
    },
    attributes: ["container_id", "owner_id", "slot_role"],
    order: [
      ["owner_id", "ASC"],
      ["slot_role", "ASC"],
      ["container_id", "ASC"],
    ],
    transaction: tx,
  });

  const ownersByActorId = new Map();
  for (const row of ownerRows) {
    const owner = row.get({ plain: true });
    const actorId = Number(owner.owner_id);
    if (!ownersByActorId.has(actorId)) ownersByActorId.set(actorId, []);
    ownersByActorId.get(actorId).push({
      slotRole: owner.slot_role,
      containerId: Number(owner.container_id),
    });
  }

  const containerIds = Array.from(new Set(ownerRows.map((row) => Number(row.container_id))));
  const containerRows = containerIds.length
    ? await db.GaContainer.findAll({
        where: { id: containerIds },
        attributes: ["id", "container_def_id", "state", "rev"],
        order: [["id", "ASC"]],
        transaction: tx,
      })
    : [];

  const lootSlotRows = containerIds.length
    ? await db.GaContainerSlot.findAll({
        where: { container_id: containerIds },
        attributes: ["container_id", "slot_index", "item_instance_id", "qty"],
        order: [
          ["container_id", "ASC"],
          ["slot_index", "ASC"],
        ],
        transaction: tx,
      })
    : [];

  const lootItemInstanceIds = Array.from(
    new Set(
      lootSlotRows
        .map((row) => {
          const slot = row.get({ plain: true });
          return slot.item_instance_id == null || Number(slot.qty ?? 0) <= 0
            ? null
            : Number(slot.item_instance_id);
        })
        .filter((id) => id != null)
    )
  );

  const lootItemInstances = lootItemInstanceIds.length
    ? await db.GaItemInstance.findAll({
        where: { id: lootItemInstanceIds },
        attributes: ["id", "item_def_id"],
        order: [["id", "ASC"]],
        transaction: tx,
      })
    : [];

  const lootItemDefIds = Array.from(
    new Set(
      lootItemInstances
        .map((row) => Number(row.item_def_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  const lootItemDefs = lootItemDefIds.length
    ? await db.GaItemDef.findAll({
        where: { id: lootItemDefIds },
        attributes: ["id", "code", "name", "category"],
        order: [["id", "ASC"]],
        transaction: tx,
      })
    : [];

  const containersById = new Map(
    containerRows.map((row) => {
      const container = row.get({ plain: true });
      return [
        Number(container.id),
        {
          id: Number(container.id),
          containerDefId: Number(container.container_def_id),
          state: container.state,
          rev: Number(container.rev ?? 0),
        },
      ];
    })
  );

  const lootItemInstancesById = new Map(
    lootItemInstances.map((row) => [Number(row.id), row.get({ plain: true })])
  );
  const lootItemDefsById = new Map(
    lootItemDefs.map((row) => [Number(row.id), row.get({ plain: true })])
  );

  const containerHasItems = new Map();
  const lootSummaryByContainerId = new Map();

  for (const row of lootSlotRows) {
    const slot = row.get({ plain: true });
    const containerId = Number(slot.container_id);
    const hasItem = slot.item_instance_id != null && Number(slot.qty ?? 0) > 0;

    if (hasItem) containerHasItems.set(containerId, true);
    else if (!containerHasItems.has(containerId)) containerHasItems.set(containerId, false);

    if (!hasItem) continue;

    const itemInstance = lootItemInstancesById.get(Number(slot.item_instance_id));
    if (!itemInstance) continue;

    const itemDef = lootItemDefsById.get(Number(itemInstance.item_def_id)) || null;
    const itemSummary = {
      itemInstanceId: Number(itemInstance.id),
      itemDefId: Number(itemInstance.item_def_id),
      code: itemDef?.code ?? null,
      name: itemDef?.name ?? itemDef?.code ?? `Item ${itemInstance.item_def_id}`,
      category: itemDef?.category ?? null,
      qty: Number(slot.qty ?? 0),
      slotIndex: Number(slot.slot_index ?? 0),
    };

    const currentSummary =
      lootSummaryByContainerId.get(containerId) ??
      {
        containerId,
        items: [],
        totalQty: 0,
        primaryItem: null,
      };

    currentSummary.items.push(itemSummary);
    currentSummary.totalQty += itemSummary.qty;
    if (!currentSummary.primaryItem) currentSummary.primaryItem = itemSummary;

    lootSummaryByContainerId.set(containerId, currentSummary);
  }

  const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

  for (const [actorId, links] of ownersByActorId.entries()) {
    const actor = actorsById.get(actorId);
    if (!actor) continue;

    const actorLootContainers = [];
    actor.containers = links
      .map((link) => {
        const container = containersById.get(link.containerId) || null;
        if (String(link.slotRole ?? "").toUpperCase() === "LOOT") {
          const lootSummary = lootSummaryByContainerId.get(link.containerId) ?? null;
          if (lootSummary) actorLootContainers.push(lootSummary);
        }

        return {
          slotRole: link.slotRole,
          containerId: link.containerId,
          containerDefId: container?.containerDefId ?? null,
          state: container?.state ?? null,
          rev: container?.rev ?? null,
        };
      })
      .sort((a, b) => String(a.slotRole).localeCompare(String(b.slotRole)));

    if (actorLootContainers.length === 1) {
      actor.lootSummary = actorLootContainers[0];
    } else if (actorLootContainers.length > 1) {
      actor.lootSummary = {
        items: actorLootContainers.flatMap((summary) => summary.items ?? []),
        totalQty: actorLootContainers.reduce(
          (sum, summary) => sum + Number(summary.totalQty ?? 0),
          0
        ),
        primaryItem: actorLootContainers.map((summary) => summary.primaryItem).find(Boolean) ?? null,
      };
    } else {
      actor.lootSummary = null;
    }
  }

  const staleGroundLootActors = actors.filter((actor) => {
    const actorDefCode = String(actor.actorDefCode ?? "").trim().toUpperCase();
    const actorKind = String(actor.actorKind ?? "").trim().toUpperCase();
    if (actorDefCode !== "GROUND_LOOT" && actorKind !== "LOOT") return false;

    const lootContainer = actor.containers.find(
      (container) => String(container?.slotRole ?? "").toUpperCase() === "LOOT"
    );
    if (!lootContainer?.containerId) return false;
    return containerHasItems.get(Number(lootContainer.containerId)) !== true;
  });

  if (staleGroundLootActors.length > 0) {
    const staleActorIds = staleGroundLootActors.map((actor) => actor.id);
    const staleContainerIds = staleGroundLootActors
      .map((actor) =>
        actor.containers.find(
          (container) => String(container?.slotRole ?? "").toUpperCase() === "LOOT"
        )?.containerId ?? null
      )
      .filter((id) => id != null);

    await db.GaActor.destroy({ where: { id: staleActorIds }, transaction: tx }).catch(() => {});
    if (staleContainerIds.length > 0) {
      await db.GaContainer.destroy({ where: { id: staleContainerIds }, transaction: tx }).catch(() => {});
    }
  }

  return actors.filter((actor) => !staleGroundLootActors.some((stale) => stale.id === actor.id));
}

async function loadActorsForInstance(instanceIdRaw, opts = {}) {
  const instanceId = Number(instanceIdRaw);
  if (!Number.isInteger(instanceId) || instanceId <= 0) {
    throw new Error(`loadActorsForInstance: invalid instanceId=${instanceIdRaw}`);
  }

  const includeContainers = opts.includeContainers !== false;
  const status = opts.status === undefined ? "ACTIVE" : opts.status;

  return db.sequelize.transaction(async (tx) => {
    await ensureRuntimeActorsForSpawns(instanceId, tx);

    const where = { instance_id: instanceId };
    if (status != null) where.status = status;

    const actorRows = await db.GaActor.findAll({
      where,
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
      transaction: tx,
    });

    const actors = actorRows.map(buildActorPayload);
    if (!includeContainers || actors.length === 0) return actors;

    return attachContainersAndLoot(actors, tx);
  });
}

module.exports = {
  loadActorsForInstance,
};
