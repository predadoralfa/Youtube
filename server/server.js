require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const {
  startPersistenceLoop,
  stopPersistenceLoop,
  flushUserRuntimeImmediate,
  flushUserStatsImmediate,
} = require("./state/persistenceManager");
const { startMovementTick, stopMovementTick } = require("./state/movementTick");
const { startSpawnManager, stopSpawnManager } = require("./state/spawnManager");
const {
  startResourceRegenLoop,
  stopResourceRegenLoop,
} = require("./state/resourceRegen/resourceRegenLoop");
const { getAllRuntimes } = require("./state/runtimeStore");

const db = require("./models");
const { initWorldClock } = require("./service/worldClockService");

const authRouter = require("./router/authRouter");
const worldRouter = require("./router/worldRouter");
const { registerSocket } = require("./socket");

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.originalUrl}`);
  next();
});

app.use("/auth", authRouter);
app.use("/world", worldRouter);

async function bootstrap() {
  let httpServer = null;

  try {
    await db.sequelize.authenticate();
    console.log("Conexao com o banco estabelecida!");

    httpServer = createServer(app);

    const io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    registerSocket(io);

    await initWorldClock();
    console.log("[WORLD CLOCK] Initialized");

    startPersistenceLoop();
    startMovementTick(io);
    startSpawnManager(io);
    startResourceRegenLoop(io);

    httpServer.listen(5100, () => {
      console.log("[SERVER] Servidor rodando na porta 5100");
      console.log("[SOCKET] Rodando");
    });

    const shutdown = async (signal) => {
      console.log(`[SERVER] shutdown signal=${signal}`);
      try {
        stopMovementTick();
        stopSpawnManager();
        stopResourceRegenLoop();
        stopPersistenceLoop();

        for (const rt of getAllRuntimes()) {
          await flushUserRuntimeImmediate(rt.userId);
          await flushUserStatsImmediate(rt.userId);
        }

        if (httpServer) {
          await new Promise((resolve) => httpServer.close(() => resolve()));
        }

        await db.sequelize.close();
      } catch (err) {
        console.error("[SERVER] shutdown error:", err);
      } finally {
        process.exit(0);
      }
    };

    process.on("SIGINT", () => shutdown("SIGINT"));
    process.on("SIGTERM", () => shutdown("SIGTERM"));
  } catch (error) {
    console.error("Erro ao iniciar servidor:");
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
