require("dotenv").config();

const express = require("express");
const cors = require("cors");
const db = require("./models");

// ROTAS
const authRouter = require("./router/authRouter");
const worldRouter = require("./router/worldRouter");

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

    app.listen(5100, () => {
      console.log("Servidor rodando na porta 5100");
    });

  } catch (error) {
    console.error("Erro ao iniciar servidor:");
    console.error(error);
    process.exit(1); // encerra processo se não conectar
  }
}

bootstrap();
