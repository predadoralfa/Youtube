# cliente/
    vite.config.js
    package.json
    package-lock.json
    .env.development
    .env.production
    src/
        App.jsx
        main.jsx
        3dx/
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

        style/
            auth.css

        World/
            WolrdRoot.jsx
            GameShell.jsx

            scene/
                GameCanvas.jsx

                camera/
                    camera.js

                light/
                    light.js

### ============================================================

# server
    package.json
    package-lock.json
    server.js
    middlewate/
        requireAuth.js

    models/
        muitos

    router/
        authRouter.js
        worldRouter.js

    services/
        authService.js
        worldService.js