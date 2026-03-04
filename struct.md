# cliente/
    vite.config.js
    .env.development
    .env.production
    src/
        App.jsx
        main.jsx
        components/
            models/
                auth/
                    index.js
                    LoginModal.jsx
                    RegisterModal.jsx

                inventory/
                    InventoryModal.jsx

            overlays/
                index.js
                LoadingOverlay.jsx

        imag/
            auth.png

        inventory/
            inventoryProbe.js

        pages/
            AuthPage.jsx

        services/
           Api.js
           Auth.js
           World.js
           Socket.js

        style/
            auth.css
            Inventory.Modal.css

        cliente/src/World/
                    ├── scene/
                    │   ├── GameCanvas.jsx          ⭐ NOVO - Orquestrador limpo
                    │   ├── environment/
                    │   │   └── Ground.jsx          ✨ NOVO - Chão + grid + limites
                    │   ├── camera/
                    │   │   └── camera.js
                    │   └── light/
                    │       └── light.js
                    │
                    ├── entities/
                    │   ├── character/
                    │   │   ├── PlayersLayer.jsx    ✨ NOVO - Entidades replicadas
                    │   │   ├── Player.jsx
                    │   │   └── player.js
                    │   │
                    │   └── actors/                 ✅ EXISTENTE - Modular
                    │       ├── ActorsLayer.jsx
                    │       ├── ActorMappings.js
                    │       ├── ChestActor.jsx
                    │       ├── TreeActor.jsx
                    │       ├── NPCActor.jsx
                    │       └── DefaultActor.jsx
                    │
                    ├── input/
                    │   ├── InputBus.js
                    │   ├── inputs.js
                    │   ├── intents.js
                    │   └── ...
                    │
                    ├── state/
                    │   ├── entitiesStore.js
                    │   └── ...
                    │
                    ├── GameShell.jsx
                    └── WorldRoot.jsx

### ============================================================

# server/
    package.json
    package-lock.json
    server.js
    .sequelizerc
    config/
        config.csj

    middlewate/
        requireAuth.js

    migrations/
        ....

    models/
        database.js
        ga_container_def.js
        ga_container_slot.js
        ga_era_def.js
        ga_instace.js
        ga_item_def.js
        ga_item_def_component.js
        ga_item_instance.js
        ga_local_instance.js
        ga_local_geometry.js
        ga_local_visual.js
        ga_local.js
        ga_material.js
        ga_mesh_template.js
        ga_render_material.js
        ga_user_container.js
        ga_userprofile.js
        ga_user_runtime.js
        ga_user_stats.js
        ga_user.js
        index.js       


    router/
        authRouter.js
        worldRouter.js

    services/
        authService.js
        inventoryProvisioning.js
        worldService.js

    socket/
        index.js
        sessionIndex.js


        handlers/
            moveHandler.js
            worldHandler.js
            clickMoveHandler.js
            inventoryHandler.js
            move/
                applyWASD.js
                broadcast.js
                config.js
                throttle.js
                validate.js

            world/
                baseline.js
                entity.js
                interest.js
                join.js
                resync.js
                rooms.js

        wiring/
            auth.js
            handlers.js
            lifecycle.js
            persistenceHook.js
            session.js
            
    state/
        runtimeStore.js
        persistenceManager.js
        persistenceIndex.js
        movementTick.js
        inventory/
            fullPayload.js
            loader.js
            store.js
            ops/
                merge.js
                move.js
                split.js

            persist/
                flush.js

            validate/
                errors.js
                rules.js

        runtime/
            chunk.js
            constants.js
            dirty.js
            inputPolicy.js
            loader.js
            store.js

        presence/
            config.js
            keys.js
            math.js
            read.js
            mutate.js
            store.js

        persistence/
            config.js
            clock.js
            disconnects.js
            events.js
            flusbatch.js
            loop.js
            rev.js
            writers.js

        movement/
            chunkTransition.js
            clock.js
            config.js
            emit.js
            entity.js
            loop.js
            math.js
            tickOnce.js