// server/service/actorCollectService.js
"use strict";

const db = require("../models");
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { buildInventoryFull } = require("../state/inventory/fullPayload");
const { ensureEquipmentLoaded } = require("../state/equipment/loader");
const { loadCarryWeightStats } = require("../state/inventory/weight");
const { getRuntime } = require("../state/runtime/store");
const { ensureResearchLoaded, hasCapability } = require("./researchService");

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

  return await db.sequelize.transaction(async (tx) => {
    async function destroyActorAndLootContainer(actorIdToDestroy, lootContainerIdToDestroy, lootContainerRow) {
      await db.GaActor.update(
        { status: "DISABLED" },
        { where: { id: actorIdToDestroy }, transaction: tx }
      );

      await db.GaActor.destroy({
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
    const actor = await db.GaActor.findByPk(actorId, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });

    if (!actor) {
      return { ok: false, error: "ACTOR_NOT_FOUND" };
    }

    const actorType = String(actor.actor_type ?? "").trim().toUpperCase();
    const shouldDespawnWhenEmpty = actorType !== "TREE";

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

    const collectUnlockCode =
      String(actorType) === "TREE" &&
      String(actorState?.resourceType ?? "").toUpperCase() === "APPLE_TREE"
        ? "actor.collect:APPLE_TREE"
        : null;

    if (collectUnlockCode) {
      const rt = getRuntime(userId);
      const research = await ensureResearchLoaded(userId, rt ?? { userId });
      if (!hasCapability(rt ?? { research }, collectUnlockCode)) {
        return {
          ok: false,
          error: "RESEARCH_REQUIRED_FOR_COLLECT",
          message: "Study apples further before collecting them from trees",
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
      return { ok: false, error: "PLAYER_NO_CONTAINERS" };
    }

    const playerContainerIds = playerOwners.map((o) => Number(o.container_id));

    // ================================================================
    // 5) BUSCAR TODOS OS SLOTS DO PLAYER (em todos containers)
    // ================================================================
    const playerSlots = await db.GaContainerSlot.findAll({
      where: { container_id: playerContainerIds },
      transaction: tx,
      lock: tx.LOCK.UPDATE,
      order: [
        ["container_id", "ASC"],
        ["slot_index", "ASC"],
      ],
    });

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
        actorType,
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
        components: [],
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
      loot: {
        itemDefId: String(itemDef.id),
        itemName: itemDef.name ?? itemDef.code ?? null,
        qty: qtyToMove,
      },
      message: actorWouldBeEmpty && !shouldDespawnWhenEmpty ? "This tree has no more fruits right now" : null,
    };
  });
}

module.exports = { attemptCollectFromActor };
