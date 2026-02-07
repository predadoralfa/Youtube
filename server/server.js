import express from "express"
import cors from "cors"
import authRouter from "./router/authRouter.js"

const app = express();

app.use(cors());
app.use(express.json());
app.use("/auth", authRouter)


//Start Server

app.listen(5100, () => {
    console.log("Servidor rodando na porta 5100");
});