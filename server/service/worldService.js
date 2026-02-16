const { GaUserRuntime, GaInstance, GaLocal, GaLocalGeometry, GaLocalVisual, GaMaterial } = require("../models");

const bootstrap = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) Runtime (âncora do mundo)
    const runtime = await GaUserRuntime.findOne({
      where: { user_id: userId },
      attributes: ["user_id", "instance_id", "pos_x", "pos_y", "pos_z", "yaw"],
    });

    if (!runtime) {
      return res.status(500).json({ message: "Runtime ausente (inconsistência)" });
    }

    // 2) Instância + Local template (geometry + visual + material)
    const instance = await GaInstance.findByPk(runtime.instance_id, {
      attributes: ["id", "local_id", "instance_type", "status"],
      include: [
        {
          model: GaLocal,
          as: "local",
          attributes: ["id", "code", "name", "local_type", "parent_id"],
          include: [
            { model: GaLocalGeometry, as: "geometry", attributes: ["size_x", "size_z"] },
            {
              model: GaLocalVisual,
              as: "visual",
              attributes: ["ground_material_id"],
              include: [
                { model: GaMaterial, as: "groundMaterial", attributes: ["id", "code", "name", "friction", "restitution"] }
              ],
            },
          ],
        },
      ],
    });

    if (!instance) {
      return res.status(500).json({ message: "Instância inexistente (inconsistência)" });
    }

    if (instance.status !== "ONLINE") {
      // por agora: bloqueia
      return res.status(409).json({ message: "Instância não está ONLINE" });
    }

    const local = instance.local;
    if (!local) {
      return res.status(500).json({ message: "Local inexistente (inconsistência)" });
    }

    // 3) Payload mínimo para Fase 1 (chão invisível + limites)
    const sizeX = local.geometry?.size_x ?? 200;
    const sizeZ = local.geometry?.size_z ?? 200;

    // version simples (depois vira hash/etag)
    const localTemplateVersion = `local:${local.id}:v1`;

    console.log("[WORLD] user:", req.user);
    console.log("[WORLD] instance:", { id: instance.id, status: instance.status, local_id: instance.local_id });
    console.log("[WORLD] local:", { id: local.id, code: local.code });
    console.log("[WORLD] geometry:", { sizeX, sizeZ });


    return res.json({
      ok: true,
      snapshot: {
        runtime: {
          user_id: runtime.user_id,
          instance_id: runtime.instance_id,
          pos_x: runtime.pos_x,
          pos_y: runtime.pos_y,
          pos_z: runtime.pos_z,
          yaw: runtime.yaw,
        },
        instance: {
          id: instance.id,
          local_id: instance.local_id,
          instance_type: instance.instance_type,
          status: instance.status,
        },
        localTemplateVersion,
        localTemplate: {
          local: {
            id: local.id,
            code: local.code,
            name: local.name,
            local_type: local.local_type,
            parent_id: local.parent_id,
          },
          geometry: {
            size_x: sizeX,
            size_z: sizeZ,
          },
          visual: {
            // hoje ainda não existe render-material no banco, então isso é hint
            ground_material: {
              id: local.visual?.groundMaterial?.id ?? null,
              code: local.visual?.groundMaterial?.code ?? "DEFAULT",
              name: local.visual?.groundMaterial?.name ?? "Default",
              // físico (ainda), guardamos porque já está aí
              friction: local.visual?.groundMaterial?.friction ?? null,
              restitution: local.visual?.groundMaterial?.restitution ?? null,
            },
            // placeholder temporário (você pode trocar depois pelo metadado real)
            ground_color: "#5a5a5a",
          },
          debug: {
            bounds: { size_x: sizeX, size_z: sizeZ },
          },
        },
      },
    });
  } catch (error) {
    console.error("Erro no bootstrap:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

module.exports = { bootstrap };
