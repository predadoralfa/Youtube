"use strict";

const {
  sequelize,
  GaUser,
  GaUserProfile,
  GaUserStats,
  GaUserRuntime,
  GaUserMacroConfig,
} = require("../../models");
const { ensureStarterInventory } = require("../inventoryProvisioning");
const { instanceIdInicial } = require("./shared");

const register = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { email, senha, nome } = req.body;

    if (!email || !senha || !nome) {
      await t.rollback();
      return res.status(400).json({ message: "Dados obrigatorios ausentes" });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const displayName = String(nome).trim();

    if (displayName.length < 3 || displayName.length > 32) {
      await t.rollback();
      return res.status(400).json({ message: "Nome invalido (3-32 chars)" });
    }

    const [emailExiste, nomeExiste] = await Promise.all([
      GaUser.findOne({ where: { email: emailNorm }, transaction: t }),
      GaUserProfile.findOne({
        where: { display_name: displayName },
        transaction: t,
      }),
    ]);

    if (emailExiste) {
      await t.rollback();
      return res.status(409).json({ message: "Email ja cadastrado" });
    }

    if (nomeExiste) {
      await t.rollback();
      return res.status(409).json({ message: "Nome ja em uso" });
    }

    const novoUser = await GaUser.create(
      { email: emailNorm, senha },
      { transaction: t }
    );

    const novoProfile = await GaUserProfile.create(
      { user_id: novoUser.id, display_name: displayName },
      { transaction: t }
    );

    await GaUserStats.create(
      { user_id: novoUser.id },
      { transaction: t }
    );

    await GaUserRuntime.create(
      { user_id: novoUser.id, instance_id: instanceIdInicial },
      { transaction: t }
    );

    await ensureStarterInventory(novoUser.id, t);
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

    if (error?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Email ou nome ja cadastrado" });
    }

    console.error("Erro ao registrar usuario", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

module.exports = {
  register,
};
