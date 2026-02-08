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

module.exports = { register };