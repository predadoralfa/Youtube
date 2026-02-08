require('dotenv').config();
const express = require("express");
const cors = require("cors");
const db = require("./models")


//ROTAS
const authRouter = require("./router/authRouter");

const app = express();

app.use(cors());
app.use(express.json());


app.use("/auth", authRouter)

db.sequelize.authenticate();
db.sequelize.sync();

//Start Server

app.listen(5100, () => {
    console.log("Servidor rodando na porta 5100");
});