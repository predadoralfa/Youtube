"use strict";

const db = require("../../models");

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

    await db.GaActorRuntime.destroy({ where: { id: staleActorIds }, transaction: tx }).catch(() => {});
    if (staleContainerIds.length > 0) {
      await db.GaContainer.destroy({ where: { id: staleContainerIds }, transaction: tx }).catch(() => {});
    }
  }

  return actors.filter((actor) => !staleGroundLootActors.some((stale) => stale.id === actor.id));
}

module.exports = {
  attachContainersAndLoot,
};
