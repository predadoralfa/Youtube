const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { User } = require("../models");

const register = async (req, res) => {
    try{
        const{ email, senha, nome } = req.body;


        // 1. validação mínima
        if( !email || !senha || !nome ){
            return res.status(400).json({
                message: "Dados obrigatório ausentes"
            });
        }

        // 2. Verificação se o email já existe
        const userExistente = await  User.findOne({ where: {email} });

        if(userExistente){
            return res.status(409).json({
                message: "Email já cadastrado"
            });
        }

        const novoUsuario = await User.create({
            email,senha,nome
        });
        console.log("Novo usuário cadastrado")

        return res.status(201).json({
            success: true,
            message: "Conta cadastrada",
            user: {
                id: novoUsuario.id,
                email: novoUsuario.email,
                nome: novoUsuario.nome
            }
        });



    } catch (error) {
        console.error("Erro ao registrar usuário", error);
        return res.status(500).json({
            message: "Erro interno do servidor"
        });
    }
}


const login = async (req, res) => {
    try{
        const{ email, senha } = req.body;
        console.log("[AUTHSERVICE] ", email, senha)


        // 1. validação mínima
        if( !email || !senha ){
            return res.status(400).json({
                message: "Dados obrigatório ausentes"
            });
        }

        const user = await User.findOne({ where: { email } });
        if(!user) {
            return res.status(401).json({error: "Sobrevivente não encotrado"});
        }

        const senhaValida = await bcrypt.compare(senha, user.senha);
        if(!senhaValida) {
            return res.status(401).json({ error: "Credeciais inválidas"})
        }

        console.log("[AUTHSERVICE] ID do jogador", user.id)
        const token = jwt.sign(
            { id: user.id, nome: user.nome },
            process.env.JWT_SECRET || 'chave_mestra_extrema',
            { expiresIn: '24h'}
        );

        //retorna dados
        res.json({
            token,
            usuario: { id: user.id, nome: user.nome }
        });
    } catch (error) {
        res.status(500).json({ error: "Erro interno do servidor"})
    };    
}
module.exports = { register, login };