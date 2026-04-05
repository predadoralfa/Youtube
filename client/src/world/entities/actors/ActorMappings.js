/**
 * ActorMappings.js
 * 
 * Define o mapeamento de actorType -> componente React Three Fiber
 * Extensível: adicione novos tipos conforme necessário
 */

import { ChestActor } from "./ChestActor";
import { TreeActor } from "./TreeActor";
import { NPCActor } from "./NPCActor";
import { DefaultActor } from "./DefaultActor";

/**
 * Retorna o componente para renderizar um actor baseado no tipo
 * @param {string} actorType - Ex: "CHEST", "TREE", "NPC"
 * @returns {React.Component} componente React Three Fiber
 */
export function getActorComponent(actorType) {
  const typeMap = {
    BAU: ChestActor,
    CHEST: ChestActor,
    GROUND_LOOT: DefaultActor,
    TREE: TreeActor,
    NPC: NPCActor,
    // Adicione mais tipos aqui conforme necessário
  };

  return typeMap[actorType] || DefaultActor;
}

/**
 * Config por tipo de actor (tamanho, escala, interação)
 */
export const ACTOR_CONFIG = {
  CHEST: {
    scale: 1,
    interactive: true,
    label: "Baú",
    color: 0x8b4513,
  },
  BAU: {
    scale: 1,
    interactive: true,
    label: "Baú",
    color: 0x8b4513,
  },
  GROUND_LOOT: {
    scale: 0.5,
    interactive: true,
    label: "Loot",
    color: 0xc1c7d0,
  },
  TREE: {
    scale: 2,
    interactive: false,
    label: "Árvore",
    color: 0x228b22,
  },
  NPC: {
    scale: 1.5,
    interactive: true,
    label: "NPC",
    color: 0x4169e1,
  },
  DEFAULT: {
    scale: 1,
    interactive: false,
    label: "Objeto",
    color: 0x808080,
  },
};

export function getActorConfig(actorType) {
  return ACTOR_CONFIG[actorType] || ACTOR_CONFIG.DEFAULT;
}
