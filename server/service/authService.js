const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

// MODELS
const {
  sequelize,
  GaUser,
  GaUserProfile,
  GaUserStats,
  GaUserRuntime,
  GaUserMacroConfig,
} = require("../models"); // ajuste o caminho se necessÃ¡rio

// INVENTORY PROVISIONING (interno, transacional)
const { ensureStarterInventory } = require("./inventoryProvisioning");


// Mantido aqui para o arquivo nÃ£o quebrar por "instanceIdInicial is not defined".
const instanceIdInicial = 1;

const register = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { email, senha, nome } = req.body; // "nome" vira display_name

    // 1) validaÃ§Ã£o mÃ­nima
    if (!email || !senha || !nome) {
      await t.rollback();
      return res.status(400).json({ message: "Dados obrigatÃ³rios ausentes" });
    }

    // 2) normalizaÃ§Ãµes bÃ¡sicas
    const emailNorm = String(email).trim().toLowerCase();
    const displayName = String(nome).trim();

    if (displayName.length < 3 || displayName.length > 32) {
      await t.rollback();
      return res.status(400).json({ message: "Nome invÃ¡lido (3-32 chars)" });
    }

    // 3) checa email (GaUser) e display_name (Profile)
    const [emailExiste, nomeExiste] = await Promise.all([
      GaUser.findOne({ where: { email: emailNorm }, transaction: t }),
      GaUserProfile.findOne({
        where: { display_name: displayName },
        transaction: t,
      }),
    ]);

    if (emailExiste) {
      await t.rollback();
      return res.status(409).json({ message: "Email jÃ¡ cadastrado" });
    }

    if (nomeExiste) {
      await t.rollback();
      return res.status(409).json({ message: "Nome jÃ¡ em uso" });
    }

    // 4) cria usuÃ¡rio (senha serÃ¡ hash pelo hook)
    const novoUser = await GaUser.create(
      { email: emailNorm, senha },
      { transaction: t }
    );

    // 5) cria profile separado
    const novoProfile = await GaUserProfile.create(
      { user_id: novoUser.id, display_name: displayName },
      { transaction: t }
    );

    // 6) cria status separado
    await GaUserStats.create(
      { user_id: novoUser.id },
      { transaction: t }
    );

    // 7) cria localizaÃ§Ã£o separado
    await GaUserRuntime.create(
      { user_id: novoUser.id, instance_id: instanceIdInicial },
      { transaction: t }
    );

    // 8) provisiona inventÃ¡rio inicial (HAND_L/HAND_R + slots vazios)
    await ensureStarterInventory(novoUser.id, t);
    // 9) provisiona macro default (slot unico AUTO_FOOD por usuario)
    await GaUserMacroConfig.findOrCreate({
      where: {
        user_id: Number(novoUser.id),
        macro_code: "AUTO_FOOD",
      },
      defaults: {
        user_id: Number(novoUser.id),
        macro_code: "AUTO_FOOD",
        is_active: false,
        config_json: null,
        state_json: null,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    

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

    // Se vocÃª tiver constraint UNIQUE no banco, isso ajuda a responder bonito:
    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Email ou nome jÃ¡ cadastrado" });
    }

    console.error("Erro ao registrar usuÃ¡rio", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

const login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    console.log("[AUTHSERVICE] ", email);

    if (!email || !senha) {
      return res.status(400).json({ message: "Dados obrigatÃ³rios ausentes" });
    }

    const emailNorm = String(email).trim().toLowerCase();

    // pega usuÃ¡rio + profile
    const user = await GaUser.findOne({
      where: { email: emailNorm },
      include: [
        { model: GaUserProfile, as: "profile", attributes: ["display_name"] },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: "Sobrevivente nÃ£o encontrado" });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ error: "Credenciais invÃ¡lidas" });
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

