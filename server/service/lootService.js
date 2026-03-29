// server/service/lootService.js

/**
 * =====================================================================
 * LOOT SERVICE - Gerenciar loot de inimigos mortos
 * =====================================================================
 *
 * Responsabilidade:
 * - Criar container de loot quando inimigo morre
 * - Associar container à posição do inimigo
 * - Popular com itens baseado em definição
 *
 * =====================================================================
 */

const db = require("../models");

async function resolveLootContainerDef() {
  const preferredCodes = ["Stone Container", "LOOT_CONTAINER", "CHEST_10"];

  for (const code of preferredCodes) {
    const lootContainerDef = await db.GaContainerDef.findOne({
      where: { code }
    });

    if (lootContainerDef) {
      if (code !== "LOOT_CONTAINER") {
        console.warn(`[LOOT] Falling back to container def "${code}"`);
      }

      return lootContainerDef;
    }
  }

  return null;
}

/**
 * =====================================================================
 * Criar container de loot para inimigo morto
 * =====================================================================
 *
 * Fluxo:
 * 1. Inimigo morre
 * 2. Procurar definição de loot para este tipo de inimigo
 * 3. Criar container (ga_container)
 * 4. Gerar itens de loot
 * 5. Colocar itens no container
 * 6. Retornar container com sua posição
 */
async function createLootContainerForEnemy(enemyInstanceId, enemyDefId, position) {
  try {
    console.log(`[LOOT] Creating loot for enemy ${enemyInstanceId} (def=${enemyDefId})`);

    // ===================================================================
    // 1. PROCURAR CONTAINER DEF PARA ESTE TIPO DE INIMIGO
    // ===================================================================

    // Por enquanto, vamos usar um container padrão "loot_container"
    // TODO: Adicionar relação enemy_def -> loot_container_def no banco

    const lootContainerDef = await resolveLootContainerDef();

    if (!lootContainerDef) {
      console.warn(`[LOOT] No loot container def found for code "LOOT_CONTAINER" or fallback "CHEST_10"`);
      return null;
    }

    // ===================================================================
    // 2. CRIAR CONTAINER INSTANCE
    // ===================================================================

    const container = await db.GaContainer.create({
      container_def_id: lootContainerDef.id,
      slot_role: "LOOT",
      state: "ACTIVE",
      rev: 1
    });

    console.log(`[LOOT] Container created: ${container.id}`);

    // ===================================================================
    // 3. GERAR ITENS DE LOOT (SIMPLES POR ENQUANTO)
    // ===================================================================

    // TODO: Baseado em enemy_def, gerar loot table
    // Por enquanto, vamos colocar 1 item fixo

    const itemDef = await db.GaItemDef.findOne({
      where: { code: "LOOT_GOLD" }  // Item de ouro padrão
    });

    if (itemDef) {
      // Criar instância do item
      const itemInstance = await db.GaItemInstance.create({
        item_def_id: itemDef.id,
        owner_user_id: 1,  // Temporariamente, será do primeiro player que pegar
        bind_state: "NONE"
      });

      // Colocar item no container
      await db.GaContainerSlot.create({
        container_id: container.id,
        slot_index: 0,
        item_instance_id: itemInstance.id,
        qty: 1
      });

      console.log(`[LOOT] Added item ${itemDef.code} to container`);
    }

    // ===================================================================
    // 4. ASSOCIAR CONTAINER À POSIÇÃO DO INIMIGO
    // ===================================================================

    // TODO: Criar tabela ga_world_object para rastrear containers no mundo
    // Por enquanto, vamos apenas retornar com posição no response

    return {
      containerId: container.id,
      containerDefId: lootContainerDef.id,
      position: position,  // Onde o inimigo morreu
      slotCount: lootContainerDef.slot_count,
      state: "ACTIVE"
    };

  } catch (err) {
    console.error(`[LOOT] Error creating loot container:`, err);
    return null;
  }
}

module.exports = {
  createLootContainerForEnemy
};
