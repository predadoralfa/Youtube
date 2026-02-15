const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const { sequelize, GaUser, GaUserProfile } = require("../models"); // ajuste o caminho
const { Op } = require("sequelize");

const register = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { email, senha, nome } = req.body; // "nome" agora vira display_name

    // 1) validação mínima
    if (!email || !senha || !nome) {
      await t.rollback();
      return res.status(400).json({ message: "Dados obrigatórios ausentes" });
    }

    // 2) normalizações básicas
    const emailNorm = String(email).trim().toLowerCase();
    const displayName = String(nome).trim();

    if (displayName.length < 3 || displayName.length > 32) {
      await t.rollback();
      return res.status(400).json({ message: "Nome inválido (3-32 chars)" });
    }

    // 3) checa email (GaUser) e display_name (Profile)
    const [emailExiste, nomeExiste] = await Promise.all([
      GaUser.findOne({ where: { email: emailNorm }, transaction: t }),
      GaUserProfile.findOne({ where: { display_name: displayName }, transaction: t }),
    ]);

    if (emailExiste) {
      await t.rollback();
      return res.status(409).json({ message: "Email já cadastrado" });
    }

    if (nomeExiste) {
      await t.rollback();
      return res.status(409).json({ message: "Nome já em uso" });
    }

    // 4) cria usuário (senha será hash pelo hook)
    const novoUser = await GaUser.create(
      { email: emailNorm, senha },
      { transaction: t }
    );

    // 5) cria profile separado
    const novoProfile = await GaUserProfile.create(
      { user_id: novoUser.id, display_name: displayName },
      { transaction: t }
    );

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Conta cadastrada",
      user: {
        id: novoUser.id,
        email: novoUser.email,
        profile: {
          display_name: novoProfile.display_name,
        },
      },
    });
  } catch (error) {
    await t.rollback();

    // Se você tiver constraint UNIQUE no banco, isso ajuda a responder bonito:
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Email ou nome já cadastrado" });
    }

    console.error("Erro ao registrar usuário", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};


const login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    console.log("[AUTHSERVICE] ", email);

    if (!email || !senha) {
      return res.status(400).json({ message: "Dados obrigatórios ausentes" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    // pega usuário + profile
    const user = await GaUser.findOne({
      where: { email: emailNorm },
      include: [{ model: GaUserProfile, as: "profile", attributes: ["display_name"] }],
    });

    if (!user) {
      return res.status(401).json({ error: "Sobrevivente não encontrado" });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: "Credenciais inválidas" });
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

module.exports = { register, login };