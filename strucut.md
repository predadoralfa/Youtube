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
        sessionIndex.js/////////////////

        handlers/
            moveHandler.js
            worldHandler.js
            clickMoveHandler.js////////////
            
    state/
        runtimeStore.js
        persistenceManager.js
        persistenceIndex.js
        movementTick.js//////////////

