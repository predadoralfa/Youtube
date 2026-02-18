require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createServer } = require("http");          
const { Server } = require("socket.io");         

const db = require("./models");

// ROTAS
const authRouter = require("./router/authRouter");
const worldRouter = require("./router/worldRouter");

// SOCKET
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

// =====================================
// BOOTSTRAP
// =====================================

async function bootstrap() {
  try {
    await db.sequelize.authenticate();
    console.log("Conexão com o banco estabelecida!");

    // NÃO usar sync() com migrations
    // await db.sequelize.sync();

    // ✅ cria servidor HTTP a partir do app
    const httpServer = createServer(app);

    // ✅ sobe socket.io no mesmo servidor
    const io = new Server(httpServer, {
      cors: {
        origin: "*", // depois você restringe
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    // ✅ registra pipeline do socket (auth + handlers)
    registerSocket(io);
    console.log("[SOCKET] Rodando")

    // ✅ agora escuta no httpServer, não no app
    httpServer.listen(5100, () => {
      console.log("Servidor rodando na porta 5100");
    });

  } catch (error) {
    console.error("Erro ao iniciar servidor:");
    console.error(error);
    process.exit(1);
  }
}

bootstrap();
