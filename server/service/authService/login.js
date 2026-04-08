"use strict";

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const {
  GaUser,
  GaUserProfile,
} = require("../../models");

const login = async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ message: "Dados obrigatorios ausentes" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    const user = await GaUser.findOne({
      where: { email: emailNorm },
      include: [
        { model: GaUserProfile, as: "profile", attributes: ["display_name"] },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: "Sobrevivente nao encontrado" });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: "Credenciais invalidas" });
    }

    const displayName = user.profile?.display_name ?? null;

    const token = jwt.sign(
      { id: user.id, display_name: displayName },
      process.env.JWT_SECRET || "chave_mestra_extrema",
      { expiresIn: "24h" }
    );

    return res.json({
      token,
      usuario: { id: user.id, display_name: displayName },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ error: "Erro interno do servidor" });
  }
};

module.exports = {
  login,
};
