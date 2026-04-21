require("dotenv").config({ quiet: true });

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
const { getAllInventories } = require("./state/inventory/store");
const { cancel } = require("./state/inventory/authoritative");
const { withInventoryLock } = require("./state/inventory/store");

const db = require("./models");
const { initWorldClock } = require("./service/worldClockService");
const { ensureUserStatsModelSchema } = require("./state/runtime/statsSchema");
const { ensureItemDefModelSchema } = require("./state/runtime/itemSchema");

const authRouter = require("./router/authRouter");
const worldRouter = require("./router/worldRouter");
const { registerSocket } = require("./socket");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/auth", authRouter);
app.use("/world", worldRouter);

async function bootstrap() {
  let httpServer = null;

  try {
    await db.sequelize.authenticate();

    await ensureUserStatsModelSchema();
    await ensureItemDefModelSchema();

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
    });

    const shutdown = async (signal) => {
      try {
        for (const invRt of getAllInventories()) {
          if (!invRt?.heldState) continue;

          await withInventoryLock(invRt.userId, async () => {
            const tx = await db.sequelize.transaction();
            try {
              await cancel(invRt, tx);
              await tx.commit();
            } catch (err) {
              await tx.rollback().catch(() => {});
              console.warn(
                `[SERVER] failed to restore held inventory item user=${invRt?.userId}`,
                err
              );
            }
          });
        }

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
    process.on("SIGUSR2", () => shutdown("SIGUSR2"));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
