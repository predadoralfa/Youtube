// server/service/actorCollectService.js
"use strict";

const db = require("../models");
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { buildInventoryFull } = require("../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../state/equipment/loader");
const { assertCanAddItemWeight, loadCarryWeightStats } = require("../state/inventory/weight");
const { getRuntime } = require("../state/runtime/store");
const { ensureStarterInventory } = require("./inventoryProvisioning");
const { consumeGatheringStamina } = require("./gatheringStaminaService");
const { awardSkillXp, loadUserSkillSummary } = require("./skillProgressionService");
const { DEFAULT_COLLECT_COOLDOWN_MS } = require("../config/interactionConstants");
const { resolveFeverDebuffTempoMultiplier } = require("../state/conditions/fever");
const {
  ensureResearchLoaded,
  hasCapability,
  resolveResearchItemCollectTimeDelta,
} = require("./researchService");

function parseMaybeJsonObject(value) {
  if (value == null) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function resolveCollectUnlockCode(actorDefCode, actorState) {
  const resourceType = String(actorState?.resourceType ?? "").trim().toUpperCase();

  if (actorDefCode === "TREE_APPLE" && resourceType === "APPLE_TREE") {
    return "actor.collect:APPLE_TREE";
  }

  if (actorDefCode === "ROCK_NODE_SMALL" && resourceType === "ROCK_NODE_SMALL") {
    return "actor.collect:ROCK_NODE_SMALL";
  }

  if (actorDefCode === "ROCK_NODE_LARGE" && resourceType === "ROCK_NODE_LARGE") {
    return "actor.collect:ROCK_NODE_SMALL";
  }

  if (actorDefCode === "FIBER_PATCH" && resourceType === "FIBER_PATCH") {
    return "actor.collect:FIBER_PATCH";
  }

  if (actorDefCode === "TWIG_PATCH" && resourceType === "TWIG_PATCH") {
    return "actor.collect:TWIG_PATCH";
  }

  if (actorDefCode === "HERBS_PATCH" && resourceType === "HERBS_PATCH") {
    return "actor.collect:HERBS_PATCH";
  }

  return null;
}

function resolveCollectResearchCode(actorDefCode) {
  if (actorDefCode === "TREE_APPLE") return "RESEARCH_APPLE";
  if (actorDefCode === "ROCK_NODE_SMALL") return "RESEARCH_STONE";
  if (actorDefCode === "ROCK_NODE_LARGE") return "RESEARCH_STONE";
  if (actorDefCode === "FIBER_PATCH") return "RESEARCH_FIBER";
  if (actorDefCode === "TWIG_PATCH") return "RESEARCH_TWIG";
  return null;
}

function resolveCollectItemCode(actorDefCode) {
  if (actorDefCode === "TREE_APPLE") return "FOOD-APPLE";
  if (actorDefCode === "ROCK_NODE_SMALL") return "SMALL_STONE";
  if (actorDefCode === "ROCK_NODE_LARGE") return "SMALL_STONE";
  if (actorDefCode === "FIBER_PATCH") return "FIBER";
  if (actorDefCode === "TWIG_PATCH") return "GRAVETO";
  if (actorDefCode === "HERBS_PATCH") return "HERBS";
  return null;
}

async function resolveActorCollectCooldownMs(userId, actor, fallbackMs = DEFAULT_COLLECT_COOLDOWN_MS) {
  const actorDefCode = String(actor?.actorDef?.code ?? "").trim().toUpperCase();
  const actorState = actor?.state_json ?? null;
  const resourceType = String(actorState?.resourceType ?? "").trim().toUpperCase();
  const fallback = Number.isFinite(Number(fallbackMs)) ? Number(fallbackMs) : DEFAULT_COLLECT_COOLDOWN_MS;

  const rt = getRuntime(userId);
  const research = await ensureResearchLoaded(userId, rt ?? { userId }, { forceReload: false });
  const itemCode = resolveCollectItemCode(actorDefCode) ?? resourceType ?? null;
  if (!itemCode) {
    return fallback;
  }
  const collectCooldownDelta = resolveResearchItemCollectTimeDelta(research, itemCode);
  const baseCooldownMs = Math.max(30, fallback + collectCooldownDelta);

  const gatheringSkill = await loadUserSkillSummary(userId, "SKILL_GATHERING");
  const gatheringLevel = Math.max(1, Number(gatheringSkill?.currentLevel ?? 1));
  const maxLevel = Math.max(1, Number(gatheringSkill?.maxLevel ?? 100));
  const effectiveLevel = Math.min(maxLevel, gatheringLevel);
  const targetMinCooldownMs = 30;
  const reductionPerLevelMs = Math.max(0, (baseCooldownMs - targetMinCooldownMs) / maxLevel);
  const reducedCooldownMs = Math.max(
    targetMinCooldownMs,
    Math.round(baseCooldownMs - reductionPerLevelMs * effectiveLevel)
  );
  const feverTempoMultiplier = resolveFeverDebuffTempoMultiplier(
    rt?.status?.fever?.current ?? rt?.diseaseLevel ?? rt?.stats?.diseaseLevel ?? 0,
    rt?.status?.fever?.severity ?? rt?.diseaseSeverity ?? rt?.stats?.diseaseSeverity ?? 0
  );

  return Math.max(targetMinCooldownMs, Math.round(reducedCooldownMs * feverTempoMultiplier));
}

function hasResearchLevelReached(research, researchCode, minimumLevel) {
  if (!researchCode) return false;
  const study = Array.isArray(research?.studies)
    ? research.studies.find((entry) => String(entry?.code ?? "") === String(researchCode))
    : null;
  return Number(study?.currentLevel ?? 0) >= Number(minimumLevel ?? 1);
}

async function buildLootSummaryFromSlots(slots, tx) {
  const activeSlots = Array.isArray(slots)
    ? slots.filter((slot) => slot?.item_instance_id != null && Number(slot.qty ?? 0) > 0)
    : [];

  if (activeSlots.length === 0) return null;

  const itemInstanceIds = Array.from(
    new Set(
      activeSlots
        .map((slot) => Number(slot.item_instance_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (itemInstanceIds.length === 0) return null;

  const itemInstances = await db.GaItemInstance.findAll({
    where: { id: itemInstanceIds },
    transaction: tx,
    lock: tx.LOCK.UPDATE,
  });

  if (itemInstances.length === 0) return null;

  const itemDefIds = Array.from(
    new Set(
      itemInstances
        .map((row) => Number(row.item_def_id))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  const itemDefs = itemDefIds.length
    ? await db.GaItemDef.findAll({
        where: { id: itemDefIds },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      })
    : [];

  const itemInstancesById = new Map(itemInstances.map((row) => [Number(row.id), row.get({ plain: true })]));
  const itemDefsById = new Map(itemDefs.map((row) => [Number(row.id), row.get({ plain: true })]));

  const items = activeSlots
    .map((slot) => {
      const itemInstance = itemInstancesById.get(Number(slot.item_instance_id));
      if (!itemInstance) return null;

      const itemDef = itemDefsById.get(Number(itemInstance.item_def_id)) ?? null;
      return {
        itemInstanceId: Number(itemInstance.id),
        itemDefId: Number(itemInstance.item_def_id),
        code: itemDef?.code ?? null,
        name: itemDef?.name ?? itemDef?.code ?? `Item ${itemInstance.item_def_id}`,
        category: itemDef?.category ?? null,
        qty: Number(slot.qty ?? 0),
        slotIndex: Number(slot.slot_index ?? 0),
      };
    })
    .filter(Boolean);

  if (items.length === 0) return null;

  return {
    items,
    totalQty: items.reduce((sum, item) => sum + Number(item.qty ?? 0), 0),
    primaryItem: items[0],
  };
}

function buildActorUpdateFromCollect(actor, lootSummary) {
  const actorDef = actor.actorDef ?? null;
  const spawn = actor.spawn ?? null;

  return {
    actorId: String(actor.id),
    actor: {
      id: String(actor.id),
      actorType: actorDef?.code ?? null,
      actorDefCode: actorDef?.code ?? null,
      actorKind: actorDef?.actor_kind ?? null,
      displayName: actorDef?.name ?? actorDef?.code ?? `Actor ${actor.id}`,
      instanceId: Number(actor.instance_id),
      spawnId: actor.actor_spawn_id == null ? null : Number(actor.actor_spawn_id),
      pos: {
        x: Number(actor.pos_x ?? 0),
        y: Number(actor.pos_y ?? 0),
        z: Number(actor.pos_z ?? 0),
      },
      status: actor.status,
      rev: Number(actor.rev ?? 0),
      visualHint: actorDef?.visual_hint ?? null,
      state: {
        ...(parseMaybeJsonObject(actorDef?.default_state_json ?? null) || {}),
        ...(parseMaybeJsonObject(spawn?.state_override_json ?? null) || {}),
        ...(parseMaybeJsonObject(actor.state_json ?? null) || {}),
      },
      lootSummary: lootSummary ?? null,
    },
  };
}

/**
 * attemptCollectFromActor(userId, actorId)
 *
 * Coleta 1 item do container LOOT de um actor (ex: BAU).
 *
 * Regras:
 * 1. Busca container LOOT do actor (slot_role está em ga_container!)
 * 2. Encontra primeiro item não-vazio
 * 3. Busca containers equipados do player dinamicamente
 * 4. Se item é stackável:
 *    - Primeiro tenta achar stack MESMO ITEM_DEF com qty < stackMax
 *    - Se não achar, procura slot vazio (cria nova instância)
 * 5. Se item NÃO stackável: procura slot vazio
 * 6. Move 1 unidade
 * 7. Se BAU ficou vazio → status DISABLED
 * 8. Retorna payload com novo inventário
 *
 * Returns:
 * {
 *   ok: true,
 *   actorDisabled: boolean,    // ← client remove ator da cena
 *   inventoryFull: {...}       // ← payload atualizado do inventário do player
 * }
 *
 * Erros (ok: false):
 * - INVALID_USER_ID, INVALID_ACTOR_ID
 * - ACTOR_NOT_FOUND, ACTOR_NO_LOOT_CONTAINER, ACTOR_LOOT_EMPTY
 * - SOURCE_ITEM_NOT_FOUND, ITEM_DEF_NOT_FOUND
 * - PLAYER_NO_CONTAINERS, PLAYER_INVENTORY_FULL
 */
async function attemptCollectFromActor(userIdRaw, actorIdRaw) {
  const userId = Number(userIdRaw);
  const actorId = Number(actorIdRaw);

  // Validação mínima
  if (!Number.isInteger(userId) || userId <= 0) {
    return { ok: false, error: "INVALID_USER_ID" };
  }

  if (!Number.isInteger(actorId) || actorId <= 0) {
    return { ok: false, error: "INVALID_ACTOR_ID" };
  }

  try {
    return await db.sequelize.transaction(async (tx) => {
    async function destroyActorAndLootContainer(actorIdToDestroy, lootContainerIdToDestroy, lootContainerRow) {
      await db.GaActorRuntime.update(
        { status: "DISABLED" },
        { where: { id: actorIdToDestroy }, transaction: tx }
      );

      await db.GaActorRuntime.destroy({
        where: { id: actorIdToDestroy },
        transaction: tx,
      });

      if (lootContainerRow?.id != null) {
        await db.GaContainer.destroy({
          where: { id: lootContainerRow.id },
          transaction: tx,
        });
      } else if (lootContainerIdToDestroy != null) {
        await db.GaContainer.destroy({
          where: { id: lootContainerIdToDestroy },
          transaction: tx,
        });
      }
    }

    // ================================================================
    // 1) VALIDAR ACTOR E CONTAINER LOOT
    // ================================================================
    const actor = await db.GaActorRuntime.findByPk(actorId, {
      include: [
        {
          association: "actorDef",
          required: false,
        },
      ],
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!actor) {
      return { ok: false, error: "ACTOR_NOT_FOUND" };
    }

    const actorDefCode = String(actor.actorDef?.code ?? "").trim().toUpperCase();
    const actorKind = String(actor.actorDef?.actor_kind ?? "").trim().toUpperCase();
    const shouldDespawnWhenEmpty =
      actorDefCode === "GROUND_LOOT" || actorKind === "LOOT";

    // ✅ CORRIGIDO: slot_role está em ga_container, não em ga_container_owner!
    const lootOwner = await db.GaContainerOwner.findOne({
      where: {
        owner_kind: "ACTOR",
        owner_id: actorId,
      },
      include: {
        association: "container",
        required: true,
        where: {
          slot_role: "LOOT",
        },
      },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!lootOwner || !lootOwner.container) {
      return { ok: false, error: "ACTOR_NO_LOOT_CONTAINER" };
    }

    const lootContainerId = Number(lootOwner.container_id);

    // ================================================================
    // 2) BUSCAR PRIMEIRO ITEM NÃO-VAZIO NO LOOT
    // ================================================================
    const lootSlots = await db.GaContainerSlot.findAll({
      where: { container_id: lootContainerId },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
      order: [["slot_index", "ASC"]],
    });

    const srcSlot = lootSlots.find(
      (s) => s.item_instance_id != null && Number(s.qty || 0) > 0
    );

    if (!srcSlot) {
      if (shouldDespawnWhenEmpty) {
        await destroyActorAndLootContainer(actorId, lootContainerId, lootOwner.container);
        return { ok: false, error: "ACTOR_NOT_FOUND" };
      }

      return {
        ok: false,
        error: "ACTOR_LOOT_EMPTY",
        message: "This tree has no more fruits right now",
      };
    }

    // ================================================================
    // 3) CARREGAR ITEM SOURCE E DEFINIÇÃO (para stackMax)
    // ================================================================
    const srcItem = await db.GaItemInstance.findByPk(
      srcSlot.item_instance_id,
      {
        transaction: tx,
        lock: tx.LOCK.UPDATE,
      }
    );

    if (!srcItem) {
      return { ok: false, error: "SOURCE_ITEM_NOT_FOUND" };
    }

    const itemDef = await db.GaItemDef.findByPk(srcItem.item_def_id, {
      transaction: tx,
    });

    if (!itemDef) {
      return { ok: false, error: "ITEM_DEF_NOT_FOUND" };
    }

    const itemDefComponents = await db.GaItemDefComponent.findAll({
      where: { item_def_id: Number(itemDef.id) },
      transaction: tx,
      order: [["id", "ASC"]],
    });

    let actorState = null;
    if (actor?.state_json != null) {
      if (typeof actor.state_json === "string") {
        try {
          actorState = JSON.parse(actor.state_json);
        } catch {
          actorState = null;
        }
      } else {
        actorState = actor.state_json;
      }
    }

    const collectUnlockCode = resolveCollectUnlockCode(actorDefCode, actorState);
    const collectResearchCode = resolveCollectResearchCode(actorDefCode);

    if (collectUnlockCode) {
      const rt = getRuntime(userId);
      const research = await ensureResearchLoaded(userId, rt ?? { userId }, { forceReload: true });
      const hasCollectAccess =
        hasCapability(rt ?? { research }, collectUnlockCode) ||
        hasResearchLevelReached(research, collectResearchCode, 1);

      if (!hasCollectAccess) {
        return {
          ok: false,
          error: "RESEARCH_REQUIRED_FOR_COLLECT",
          message: "Study this resource further before collecting it",
        };
      }
    }

    const stackMax = Number(itemDef.stack_max || 1);
    const isStackable = stackMax > 1;

    console.log("[COLLECT] Iniciando coleta", {
      userId,
      actorId,
      itemDefId: srcItem.item_def_id,
      srcQty: srcSlot.qty,
      stackMax,
      isStackable,
    });

    // ================================================================
    // 4) BUSCAR CONTAINERS EQUIPADOS DO PLAYER (DINÂMICO)
    // ================================================================
    const playerOwners = await db.GaContainerOwner.findAll({
      where: {
        owner_kind: "PLAYER",
        owner_id: userId,
      },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
      order: [["slot_role", "ASC"]],
    });

    if (!playerOwners.length) {
      await ensureStarterInventory(userId, tx);

      const repairedOwners = await db.GaContainerOwner.findAll({
        where: {
          owner_kind: "PLAYER",
          owner_id: userId,
        },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
        order: [["slot_role", "ASC"]],
      });

      if (!repairedOwners.length) {
        return { ok: false, error: "PLAYER_NO_CONTAINERS" };
      }

      playerOwners.push(...repairedOwners);
    }

    let playerContainerIds = playerOwners.map((o) => Number(o.container_id));

    // ================================================================
    // 5) BUSCAR TODOS OS SLOTS DO PLAYER (em todos containers)
    // ================================================================
    let playerSlots = await db.GaContainerSlot.findAll({
      where: { container_id: playerContainerIds },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
      order: [
        ["container_id", "ASC"],
        ["slot_index", "ASC"],
      ],
    });

    if (!playerSlots.length) {
      await ensureStarterInventory(userId, tx);

      const repairedOwners = await db.GaContainerOwner.findAll({
        where: {
          owner_kind: "PLAYER",
          owner_id: userId,
        },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
        order: [["slot_role", "ASC"]],
      });

      playerContainerIds = repairedOwners.map((o) => Number(o.container_id));
      playerSlots = await db.GaContainerSlot.findAll({
        where: { container_id: playerContainerIds },
        transaction: tx,
        lock: tx.LOCK.UPDATE,
        order: [
          ["container_id", "ASC"],
          ["slot_index", "ASC"],
        ],
      });

      if (!playerSlots.length) {
        console.error("[COLLECT] Inventário ainda vazio após provisionamento", {
          userId,
        });
        return { ok: false, error: "PLAYER_INVENTORY_FULL" };
      }
    }

    // ================================================================
    // 5b) CARREGAR INSTÂNCIAS DO PLAYER para comparar item_def
    // ================================================================
    const playerInstanceIds = playerSlots
      .map((s) => s.item_instance_id)
      .filter((id) => id != null);

    let playerInstancesById = new Map();

    if (playerInstanceIds.length > 0) {
      const playerInstances = await db.GaItemInstance.findAll({
        where: { id: playerInstanceIds },
        transaction: tx,
      });

      playerInstancesById = new Map(
        playerInstances.map((ii) => [Number(ii.id), ii])
      );
    }

    console.log("[COLLECT] Slots do player", {
      totalSlots: playerSlots.length,
      emptySlots: playerSlots.filter((s) => s.item_instance_id == null).length,
    });

    const invRtForWeight = await ensureInventoryLoaded(userId);
    if (invRtForWeight?.heldState) {
      return { ok: false, error: "HELD_STATE_ACTIVE" };
    }
    invRtForWeight.carryWeight = await loadCarryWeightStats(userId);
    if (invRtForWeight.itemDefsById && !invRtForWeight.itemDefsById.has(String(itemDef.id))) {
      invRtForWeight.itemDefsById.set(String(itemDef.id), {
        id: String(itemDef.id),
        code: itemDef.code ?? null,
        name: itemDef.name ?? null,
        category: itemDef.category ?? itemDef.categoria ?? null,
        weight:
          itemDef.unit_weight == null
            ? itemDef.weight == null
              ? itemDef.peso == null
                ? null
                : Number(itemDef.peso)
              : Number(itemDef.weight)
            : Number(itemDef.unit_weight),
        stackMax: Number(itemDef.stack_max ?? itemDef.stackMax ?? 1) || 1,
        components: [],
      });
    }
    const eqRtForWeight = await ensureEquipmentLoaded(userId);
    const rtForWeight = getRuntime(userId);
    const researchForWeight = await ensureResearchLoaded(userId, rtForWeight ?? { userId });
    invRtForWeight.research = researchForWeight;
    try {
      assertCanAddItemWeight(invRtForWeight, eqRtForWeight, researchForWeight, itemDef, 1);
    } catch (err) {
      if (err?.code === "CARRY_WEIGHT_LIMIT") {
        return {
          ok: false,
          error: "CARRY_WEIGHT_LIMIT",
          message: err.message,
          meta: err.meta,
        };
      }
      throw err;
    }

    let dstSlot = null;
    let createdInstance = null;

    // ================================================================
    // 6) PROCURAR SLOT DE DESTINO
    // ================================================================
    // 6a) Se stackável, procura por MESMO ITEM_DEF com qty < stackMax
    if (isStackable) {
      dstSlot = playerSlots.find((s) => {
        // Slot precisa estar ocupado
        if (s.item_instance_id == null) return false;

        // Pega a instância para comparar item_def
        const existingInstance = playerInstancesById.get(
          Number(s.item_instance_id)
        );
        if (!existingInstance) return false;

        // ✅ Compara item_def (não instância!)
        if (Number(existingInstance.item_def_id) !== Number(srcItem.item_def_id)) {
          return false;
        }

        // Quantidade atual deve ser > 0 e < stackMax
        const currentQty = Number(s.qty || 0);
        return currentQty > 0 && currentQty < stackMax;
      });

      if (dstSlot) {
        console.log("[COLLECT] Stack incompleto encontrado", {
          containerId: dstSlot.container_id,
          slotIndex: dstSlot.slot_index,
          currentQty: dstSlot.qty,
          stackMax,
        });
      }
    }

    // 6b) Se não achou stack incompleto, procura slot vazio
    if (!dstSlot) {
      dstSlot = playerSlots.find((s) => s.item_instance_id == null);

      if (dstSlot) {
        console.log("[COLLECT] Slot vazio encontrado", {
          containerId: dstSlot.container_id,
          slotIndex: dstSlot.slot_index,
        });
      }
    }

    if (!dstSlot) {
      console.error("[COLLECT] Inventário cheio!", {
        userId,
        totalSlots: playerSlots.length,
        occupiedSlots: playerSlots.filter((s) => s.item_instance_id != null)
          .length,
      });
      return { ok: false, error: "PLAYER_INVENTORY_FULL" };
    }

    // ================================================================
    // 7) MOVER 1 ITEM / UNIDADE
    // ================================================================
    const qtyToMove = 1;

    if (dstSlot.item_instance_id == null) {
      // Slot vazio: criar NOVA instância
      console.log("[COLLECT] Criando nova instância para slot vazio");

      const newInstance = await db.GaItemInstance.create(
        {
          owner_user_id: userId,
          item_def_id: Number(srcItem.item_def_id),
          bind_state: srcItem.bind_state || "NONE",
          props_json: srcItem.props_json || null,
        },
        { transaction: tx }
      );

      createdInstance = newInstance;
      dstSlot.item_instance_id = newInstance.id;
      dstSlot.qty = qtyToMove;

      console.log("[COLLECT] Nova instância criada", {
        instanceId: newInstance.id,
      });
    } else {
      // Stack incompleto (mesmo item_def): apenas soma qty
      console.log("[COLLECT] Somando ao stack incompleto");
      dstSlot.qty = Number(dstSlot.qty || 0) + qtyToMove;
    }

    srcSlot.qty = Number(srcSlot.qty || 0) - qtyToMove;
    if (srcSlot.qty <= 0) {
      srcSlot.item_instance_id = null;
      srcSlot.qty = 0;
    }

    // ================================================================
    // 8) PERSISTIR SLOTS NO DB
    // ================================================================
    await Promise.all([
      db.GaContainerSlot.update(
        {
          item_instance_id: srcSlot.item_instance_id,
          qty: srcSlot.qty,
        },
        {
          where: {
            container_id: srcSlot.container_id,
            slot_index: srcSlot.slot_index,
          },
          transaction: tx,
        }
      ),
      db.GaContainerSlot.update(
        {
          item_instance_id: dstSlot.item_instance_id,
          qty: dstSlot.qty,
        },
        {
          where: {
            container_id: dstSlot.container_id,
            slot_index: dstSlot.slot_index,
          },
          transaction: tx,
        }
      ),
    ]);

    console.log("[COLLECT] Slots atualizados no DB");

    const staminaSpend = await consumeGatheringStamina(userId, tx, 1);
    if (!staminaSpend?.ok) {
      const staminaError = new Error(staminaSpend?.message ?? "Not enough stamina to collect");
      staminaError.collectResult = {
        ok: false,
        error: staminaSpend?.error ?? "INSUFFICIENT_STAMINA",
        message: staminaSpend?.message ?? "Not enough stamina to collect",
      };
      throw staminaError;
    }

    const canAwardGatheringXp =
      actorDefCode === "TREE_APPLE" ||
      actorDefCode === "ROCK_NODE_SMALL" ||
      actorDefCode === "FIBER_PATCH";

    let xpAward = null;
    if (canAwardGatheringXp) {
      try {
        xpAward = await awardSkillXp(userId, "SKILL_GATHERING", qtyToMove, tx);
      } catch (err) {
        console.warn("[COLLECT] XP gathering failed, continuing collect", {
          userId,
          actorId,
          error: String(err?.message ?? err),
        });
        xpAward = null;
      }
    }
    if (xpAward) {
      invRtForWeight.skills = invRtForWeight.skills || {};
      invRtForWeight.skills.SKILL_GATHERING = {
        skillCode: "SKILL_GATHERING",
        skillName: xpAward.skillName ?? "Gathering",
        currentLevel: xpAward.level,
        currentXp: xpAward.currentXp,
        totalXp: xpAward.totalXp,
        requiredXp: xpAward.requiredXp,
        maxLevel: 100,
      };
    }

    // ================================================================
    // 9) INCREMENTAR REV DOS CONTAINERS TOCADOS
    // ================================================================
    const touchedContainerIds = [lootContainerId, dstSlot.container_id];

    await db.GaContainer.increment(
      { rev: 1 },
      {
        where: { id: touchedContainerIds },
        transaction: tx,
      }
    );

    // ================================================================
    // 10) VERIFICAR SE ACTOR FICOU VAZIO (DISABLE)
    // ================================================================
    const remainingSlots = await db.GaContainerSlot.findAll({
      where: { container_id: lootContainerId },
      transaction: tx,
    });

    const actorWouldBeEmpty = remainingSlots.every(
      (s) => s.item_instance_id == null || Number(s.qty || 0) <= 0
    );

    const actorDisabled = shouldDespawnWhenEmpty && actorWouldBeEmpty;
    const refreshedLootSummary = actorDisabled ? null : await buildLootSummaryFromSlots(remainingSlots, tx);

    if (actorDisabled) {
      const lootContainer = lootOwner.container;
      await destroyActorAndLootContainer(actorId, lootContainerId, lootContainer);

      console.log("[COLLECT] Actor desabilitado (vazio)");
      console.log("[COLLECT] Actor removido do DB", {
        actorId,
        lootContainerId,
      });
    } else if (actorWouldBeEmpty) {
      console.log("[COLLECT] Actor permaneceu no mundo mesmo vazio", {
        actorId,
        actorDefCode,
        actorKind,
      });
    }

    // ================================================================
    // 11) SINCRONIZAR RUNTIME EM MEMÓRIA COM O QUE FOI PERSISTIDO
    // ================================================================
    const invRt = await ensureInventoryLoaded(userId);
    if (invRt?.heldState) {
      return { ok: false, error: "HELD_STATE_ACTIVE" };
    }

    invRt.carryWeight = await loadCarryWeightStats(userId);
    if (invRt.itemDefsById && !invRt.itemDefsById.has(String(itemDef.id))) {
      invRt.itemDefsById.set(String(itemDef.id), {
        id: String(itemDef.id),
        code: itemDef.code ?? null,
        name: itemDef.name ?? null,
        category: itemDef.category ?? itemDef.categoria ?? null,
        weight:
          itemDef.unit_weight == null
            ? itemDef.weight == null
              ? itemDef.peso == null
                ? null
                : Number(itemDef.peso)
              : Number(itemDef.weight)
            : Number(itemDef.unit_weight),
        stackMax: Number(itemDef.stack_max ?? itemDef.stackMax ?? 1) || 1,
        components: itemDefComponents.map((component) => ({
          id: String(component.id),
          itemDefId: String(component.item_def_id),
          componentType: component.component_type ?? null,
          dataJson:
            typeof component.data_json === "string"
              ? (() => {
                  try {
                    return JSON.parse(component.data_json);
                  } catch {
                    return component.data_json;
                  }
                })()
              : component.data_json ?? null,
          version: Number(component.version ?? 1),
        })),
      });
    }

    const runtimeContainerById = invRt.containersById || new Map();
    const syncRuntimeSlot = (containerId, slotIndex, itemInstanceId, qty) => {
      const container = runtimeContainerById.get(String(containerId));
      if (!container || !Array.isArray(container.slots)) return;
      const slot = container.slots.find((s) => Number(s.slotIndex) === Number(slotIndex));
      if (!slot) return;
      slot.itemInstanceId = itemInstanceId == null ? null : String(itemInstanceId);
      slot.qty = Number(qty || 0);
    };

    syncRuntimeSlot(srcSlot.container_id, srcSlot.slot_index, srcSlot.item_instance_id, srcSlot.qty);
    syncRuntimeSlot(dstSlot.container_id, dstSlot.slot_index, dstSlot.item_instance_id, dstSlot.qty);

    if (createdInstance) {
      invRt.itemInstanceById.set(String(createdInstance.id), {
        id: String(createdInstance.id),
        userId: String(userId),
        itemDefId: String(createdInstance.item_def_id),
        props: createdInstance.props_json ?? null,
        durability: createdInstance.durability ?? null,
      });
    } else if (dstSlot.item_instance_id != null && dstSlot.item_instance_id !== srcSlot.item_instance_id) {
      const existingInstance = playerInstancesById.get(Number(dstSlot.item_instance_id));
      if (existingInstance) {
        invRt.itemInstanceById.set(String(existingInstance.id), {
          id: String(existingInstance.id),
          userId: String(userId),
          itemDefId: String(existingInstance.item_def_id),
          props: existingInstance.props_json ?? null,
          durability: existingInstance.durability ?? null,
        });
      }
    }

    const eqRt = await ensureEquipmentLoaded(userId);
    const inventoryFull = buildInventoryFull(invRt, eqRt);
    const actorUpdate = actorDisabled ? null : buildActorUpdateFromCollect(actor, refreshedLootSummary);

    console.log("[COLLECT] ✅ Coleta bem-sucedida!", {
      userId,
      actorId,
      actorDisabled,
      newQty: dstSlot.qty,
    });

    return {
      ok: true,
      actorDisabled,
      inventoryFull,
      actorUpdate,
      stamina: {
        cost: staminaSpend.staminaCost,
        before: staminaSpend.staminaBefore,
        after: staminaSpend.staminaAfter,
        max: staminaSpend.staminaMax,
      },
      loot: {
        itemDefId: String(itemDef.id),
        itemName: itemDef.name ?? itemDef.code ?? null,
        qty: qtyToMove,
      },
      xp: xpAward
        ? {
            skillCode: xpAward.skillCode,
            skillName: xpAward.skillName,
            xpGained: xpAward.xpGained,
            level: xpAward.level,
            currentXp: xpAward.currentXp,
            requiredXp: xpAward.requiredXp,
            totalXp: xpAward.totalXp,
            leveledUp: xpAward.leveledUp,
          }
        : null,
      message: actorWouldBeEmpty && !shouldDespawnWhenEmpty ? "This tree has no more fruits right now" : null,
    };
  });
  } catch (err) {
    if (err?.collectResult) {
      return err.collectResult;
    }
    throw err;
  }
}

module.exports = {
  attemptCollectFromActor,
  resolveActorCollectCooldownMs,
};
