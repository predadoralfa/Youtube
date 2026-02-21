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

            overlays/
                index.js
                LoadingOverlay.jsx

        imag/
            auth.png

        pages/
            AuthPage.jsx

        services/
           Api.js
           Auth.js
           World.js
           Socket.js

        style/
            auth.css

        World/
            WolrdRoot.jsx
            GameShell.jsx

            entites/
                character/
                    Player.jsx
                    CharacterFactor.jsx
            
            input/
            i   inputBus.js          // barramento (pub/sub) simples
                inputs.js            // mapeia DOM events -> intents
                intents.js           // tipos: CAMERA_ZOOM, MOVE, INTERACT...

            scene/
                GameCanvas.jsx

                camera/
                    camera.js

                light/
                    light.js

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
        muitos

    router/
        authRouter.js
        worldRouter.js

    services/
        authService.js
        worldService.js

    socket/
        index.js
        sessionIndex.js


        handlers/
            moveHandler.js
            worldHandler.js
            clickMoveHandler.js
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