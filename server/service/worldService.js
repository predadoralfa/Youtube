// server/servece/worldService.js

const {
  GaUserRuntime,
  GaInstance,
  GaLocal,
  GaLocalGeometry,
  GaLocalVisual,
  GaMaterial,
  GaMeshTemplate,
  GaRenderMaterial,
} = require("../models");

const bootstrap = async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) Runtime (âncora do mundo)
    const runtime = await GaUserRuntime.findOne({
      where: { user_id: userId },
      attributes: [
        "user_id",
        "instance_id",
        "pos_x",
        "pos_y",
        "pos_z",
        "yaw",
        "connection_state",
        "disconnected_at",
        "offline_allowed_at"
      ],
    });

    if (!runtime) {
      return res.status(500).json({ message: "Runtime ausente (inconsistência)" });
    }

    // 2) Instância + Local template (geometry + visual + materiais/mesh)
    const instance = await GaInstance.findByPk(runtime.instance_id, {
      attributes: ["id", "local_id", "instance_type", "status"],
      include: [
        {
          model: GaLocal,
          as: "local",
          attributes: ["id", "code", "name", "local_type", "parent_id"],
          include: [
            {
              model: GaLocalGeometry,
              as: "geometry",
              attributes: ["size_x", "size_z"],
            },
            {
              model: GaLocalVisual,
              as: "visual",
              attributes: [
                "ground_material_id",
                "ground_mesh_id",
                "ground_render_material_id",
                "version",
              ],
              include: [
                {
                  model: GaMaterial,
                  as: "groundMaterial",
                  attributes: ["id", "code", "name", "friction", "restitution"],
                },
                {
                  model: GaMeshTemplate,
                  as: "groundMesh",
                  attributes: [
                    "id",
                    "code",
                    "mesh_kind",
                    "primitive_type",
                    "gltf_url",
                    "default_scale_x",
                    "default_scale_y",
                    "default_scale_z",
                  ],
                  required: false,
                },
                {
                  model: GaRenderMaterial,
                  as: "groundRenderMaterial",
                  attributes: [
                    "id",
                    "code",
                    "kind",
                    "base_color",
                    "texture_url",
                    "roughness",
                    "metalness",
                  ],
                  required: false,
                },
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
      return res.status(409).json({ message: "Instância não está ONLINE" });
    }

    const local = instance.local;
    if (!local) {
      return res.status(500).json({ message: "Local inexistente (inconsistência)" });
    }

    // 3) Payload mínimo para Fase 1 (chão + limites)
    const sizeX = local.geometry?.size_x ?? 200;
    const sizeZ = local.geometry?.size_z ?? 200;

    // version real do template visual (base do cache)
    const v = local.visual?.version ?? 1;
    const localTemplateVersion = `local:${local.id}:v${v}`;

    // Helpers para não explodir nulls
    const groundMaterial = local.visual?.groundMaterial ?? null;
    const groundMesh = local.visual?.groundMesh ?? null;
    const groundRenderMaterial = local.visual?.groundRenderMaterial ?? null;

    // Fallback de cor (ordem de prioridade)
    const groundColor =
      groundRenderMaterial?.base_color ??
      "#711010";

    console.log("[WORLD] USER ID = ",runtime.user_id, "INSTANCE = ",runtime.instance_id);
    console.log("[WORLD] Altura = ",runtime.pos_y);

    return res.json({
      ok: true,
      snapshot: {
        runtime: {
          user_id: runtime.user_id,
          instance_id: runtime.instance_id,
          pos: {
            x: runtime.pos_x,
            y: runtime.pos_y,
            z: runtime.pos_z,
          },
          yaw: runtime.yaw,

          // ✅ observabilidade / debug do anti-combat-log
          connection_state: runtime.connection_state,
          disconnected_at: runtime.disconnected_at,
          offline_allowed_at: runtime.offline_allowed_at,
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
            // Material físico (gameplay/colisão)
            ground_material: {
              id: groundMaterial?.id ?? null,
              code: groundMaterial?.code ?? "DEFAULT",
              name: groundMaterial?.name ?? "Default",
              friction: groundMaterial?.friction ?? null,
              restitution: groundMaterial?.restitution ?? null,
            },

            // Mesh declarativa do chão (render)
            ground_mesh: groundMesh
              ? {
                  id: groundMesh.id,
                  code: groundMesh.code,
                  mesh_kind: groundMesh.mesh_kind,
                  primitive_type: groundMesh.primitive_type,
                  gltf_url: groundMesh.gltf_url,
                  default_scale: {
                    x: groundMesh.default_scale_x,
                    y: groundMesh.default_scale_y,
                    z: groundMesh.default_scale_z,
                  },
                }
              : null,

            // Material visual declarativo do chão (render)
            ground_render_material: groundRenderMaterial
              ? {
                  id: groundRenderMaterial.id,
                  code: groundRenderMaterial.code,
                  kind: groundRenderMaterial.kind,
                  base_color: groundRenderMaterial.base_color,
                  texture_url: groundRenderMaterial.texture_url,
                  roughness: groundRenderMaterial.roughness,
                  metalness: groundRenderMaterial.metalness,
                }
              : null,

            // Fallback (por enquanto o front pode usar isso direto)
            ground_color: groundColor,

            // versão do template visual (útil pro front/cache)
            version: v,
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


