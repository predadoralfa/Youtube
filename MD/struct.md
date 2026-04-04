# 📦 Estrutura Atualizada do Projeto - Actor Collection Sistema

## cliente/ (Frontend - React + Three.js)

```
cliente/
├── vite.config.js
├── .env.development
├── .env.production
└── src/
    ├── App.jsx
    ├── main.jsx
    │
    ├── components/
    │   ├── models/
    │   │   ├── auth/
    │   │   │   ├── index.js
    │   │   │   ├── LoginModal.jsx
    │   │   │   └── RegisterModal.jsx
    │   │   │
    │   │   └── inventory/
    │   │       └── InventoryModal.jsx
    │   │
    │   └── overlays/
    │       ├── index.js
    │       └── LoadingOverlay.jsx
    │
    ├── imag/
    │   └── auth.png
    │
    ├── inventory/
    │   └── inventoryProbe.js
    │
    ├── pages/
    │   └── AuthPage.jsx
    │
    ├── services/
    │   ├── Api.js
    │   ├── Auth.js
    │   ├── World.js
    │   └── Socket.js
    │
    ├── style/
    │   ├── auth.css
    │   └── Inventory.Modal.css
    │
    └── World/
        ├── GameShell.jsx                    ✨ ATUALIZADO - integração de coleta
        ├── WorldRoot.jsx
        │
        ├── scene/
        │   ├── GameCanvas.jsx
        │   ├── TargetMarker.jsx
        │   ├── environment/
        │   │   └── Ground.jsx
        │   ├── camera/
        │   │   └── camera.js
        │   └── light/
        │       └── light.js
        │
        ├── entities/
        │   ├── character/
        │   │   ├── PlayersLayer.jsx
        │   │   ├── Player.jsx
        │   │   └── player.js
        │   │
        │   └── actors/
        │       ├── ActorsLayer.jsx
        │       ├── ActorMappings.js
        │       ├── ActorFactory.js
        │       ├── ChestActor.jsx
        │       ├── TreeActor.jsx
        │       ├── NPCActor.jsx
        │       └── DefaultActor.jsx
        │
        ├── input/
        │   ├── InputBus.js
        │   ├── inputs.js
        │   └── intents.js
        │
        ├── state/
        │   └── entitiesStore.js
        │
        ├── hooks/
        │   └── useActorCollection.js         ✨ NOVO - escuta evento de coleta

```

---

## server/ (Backend - Node.js + Express + Sequelize)

```
server/
├── package.json
├── package-lock.json
├── server.js
├── .sequelizerc
│
├── config/
│   └── config.js
│
├── middlewate/
│   └── requireAuth.js
│
├── migrations/
│   ├── ... (migrations antigas)
│   └── 20260305120000-add-collect-cooldown-to-user-stats.js  ✨ NOVO
│
├── models/
│   ├── index.js
│   ├── database.js
    ├── ga_actor.js
    ├── ga_container.js                      ✨ REVISADO (tem slot_role)
    ├── ga_container_def.js
    ├── ga_container_owner.js                ✨ REVISADO
    ├── ga_container_slot.js                 ✨ REVISADO (UNIQUE item_instance_id)
    ├── ga_era_def.js
    ├── ga_instance.js
    ├── ga_item_def.js
    ├── ga_item_def_component.js
    ├── ga_item_instance.js
    ├── ga_local.js
    ├── ga_local_geometry.js
    ├── ga_local_visual.js
    ├── ga_material.js
    ├── ga_mesh_template.js
    ├── ga_render_material.js
    ├── ga_user.js
    ├── ga_user_profile.js
    ├── ga_user_runtime.js
    ├── ga_user_stats.js                     ✨ ATUALIZADO (+ collect_cooldown_ms)
    └── ga_actor.js                          ✨ REVISADO (status: ACTIVE/DISABLED)
│
├── router/
│   ├── authRouter.js
│   └── worldRouter.js
│
├── service/
│   ├── authService.js
│   ├── inventoryProvisioning.js
│   ├── worldService.js                      ✨ ATUALIZADO (passa containers ao actorsRuntimeStore)
│   ├── actorService.js
│   ├── actorCollectService.js               ✨ NOVO - lógica de coleta (VERSÃO FINAL)
│   └── inventoryService.js                  ✨ NOVO - findOrCreateSlotForItem (genérico)
│
├── socket/
│   ├── index.js
│   ├── sessionIndex.js
│   │
│   ├── handlers/
│   │   ├── interactHandler.js               ✨ ATUALIZADO (carrega collectCooldownMs)
│   │   ├── moveHandler.js
│   │   ├── worldHandler.js
│   │   ├── clickMoveHandler.js
│   │   ├── inventoryHandler.js
│   │   │
│   │   └── move/
│   │       ├── applyWASD.js
│   │       ├── broadcast.js
│   │       ├── config.js
│   │       ├── throttle.js
│   │       └── validate.js
│   │
│   ├── wiring/
│   │   ├── auth.js
│   │   ├── handlers.js
│   │   ├── lifecycle.js
│   │   ├── persistenceHook.js
│   │   └── session.js
│   │
│   └── handlers/
│       └── world/
│           ├── baseline.js
│           ├── entity.js
│           ├── interest.js
│           ├── join.js
│           ├── resync.js
│           └── rooms.js
│
└── state/
    ├── runtimeStore.js
    ├── actorsRuntimeStore.js                ✨ ATUALIZADO (+ containers array)
    ├── persistenceManager.js
    ├── persistenceIndex.js
    │
    ├── inventory/
    │   ├── fullPayload.js
    │   ├── loader.js
    │   ├── store.js
    │   │
    │   ├── ops/
    │   │   ├── merge.js
    │   │   ├── move.js
    │   │   └── split.js
    │   │
    │   ├── persist/
    │   │   └── flush.js
    │   │
    │   └── validate/
    │       ├── errors.js
    │       └── rules.js
    │
    ├── runtime/
    │   ├── chunk.js
    │   ├── constants.js
    │   ├── dirty.js
    │   ├── inputPolicy.js
    │   ├── loader.js
    │   └── store.js
    │
    ├── presence/
    │   ├── config.js
    │   ├── keys.js
    │   ├── math.js
    │   ├── read.js
    │   ├── mutate.js
    │   └── store.js
    │
    ├── persistence/
    │   ├── config.js
    │   ├── clock.js
    │   ├── disconnects.js
    │   ├── events.js
    │   ├── flusbatch.js
    │   ├── loop.js
    │   ├── rev.js
    │   └── writers.js
    │
    └── movement/
        ├── chunkTransition.js
        ├── clock.js
        ├── config.js
        ├── emit.js
        ├── entity.js
        ├── loop.js
        ├── math.js
        └── tickOnce.js                      ✨ ATUALIZADO (HOLD-TO-COLLECT)
```

---

## 📋 Arquivos Atualizados/Novos - Resumo

### Backend

| Arquivo | Tipo | Status | Descrição |
|---------|------|--------|-----------|
| `migrations/20260305...js` | Migration | ✨ NOVO | Adiciona `collect_cooldown_ms` em `ga_user_stats` |
| `models/ga_user_stats.js` | Model | ✨ ATUALIZADO | Campo `collect_cooldown_ms` |
| `models/ga_container.js` | Model | ✨ REVISADO | Confirmar `slot_role` presente |
| `models/ga_container_owner.js` | Model | ✨ REVISADO | Sem `slot_role` (está em `ga_container`) |
| `models/ga_container_slot.js` | Model | ✨ REVISADO | UNIQUE em `item_instance_id` |
| `models/ga_actor.js` | Model | ✨ REVISADO | Status: ACTIVE/DISABLED |
| `service/actorCollectService.js` | Service | ✨ NOVO | Lógica completa de coleta (FINAL) |
| `service/inventoryService.js` | Service | ✨ NOVO | `findOrCreateSlotForItem` genérico |
| `service/worldService.js` | Service | ✨ ATUALIZADO | Passa `containers` ao `actorsRuntimeStore` |
| `state/actorsRuntimeStore.js` | Store | ✨ ATUALIZADO | Adiciona `containers` array |
| `state/movement/tickOnce.js` | Movement | ✨ ATUALIZADO | HOLD-TO-COLLECT logic |
| `socket/handlers/interactHandler.js` | Handler | ✨ ATUALIZADO | Carrega `collectCooldownMs` |

### Frontend

| Arquivo | Tipo | Status | Descrição |
|---------|------|--------|-----------|
| `World/hooks/useActorCollection.js` | Hook | ✨ NOVO | Escuta `actor:collected` |
| `World/components/CooldownBar.jsx` | Component | ✨ NOVO (opcional) | Barra visual de cooldown |
| `World/components/CooldownBar.css` | Style | ✨ NOVO (opcional) | Estilos da barra |
| `World/GameShell.jsx` | Component | ✨ ATUALIZADO | Integra hook + CooldownBar |


