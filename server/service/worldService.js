// server/service/worldService.js
// ✨ COM LOGS EXTENSOS PARA DEBUG

const {
  GaUser,
  GaUserStats,
  GaUserRuntime,
  GaInstance,
  GaLocal,
  GaLocalGeometry,
  GaLocalVisual,
  GaMaterial,
  GaMeshTemplate,
  GaRenderMaterial,
} = require("../models");

// INVENTORY (privado, autoritativo)
const { ensureInventoryLoaded } = require("../state/inventory/loader");
const { buildInventoryFull } = require("../state/inventory/fullPayload");

// ACTORS
const { loadActorsForInstance } = require("./actorLoader");
const {
  addActor,
  clearInstance: clearActorsInstance,
} = require("../state/actorsRuntimeStore");

// ENEMIES
const { loadEnemiesForInstance } = require("./enemyLoader");
const {
  addEnemy,
  clearInstance: clearEnemiesInstance,
} = require("../state/enemies/enemiesRuntimeStore");

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

const bootstrap = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[BOOTSTRAP] iniciando para userId=${userId}`);
    console.log(`${'='.repeat(80)}`);

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
        "offline_allowed_at",
      ],
    });

    if (!runtime) {
      console.error(`[BOOTSTRAP] ❌ Runtime ausente para userId=${userId}`);
      return res.status(500).json({ message: "Runtime ausente (inconsistência)" });
    }

    console.log(`[BOOTSTRAP] ✅ Runtime carregado: instanceId=${runtime.instance_id} pos=(${runtime.pos_x}, ${runtime.pos_y}, ${runtime.pos_z})`);

    // 1.1) Stats autoritativos do player (HUD)
    const user = await GaUser.findByPk(userId, {
      attributes: ["id"],
      include: [
        {
          model: GaUserStats,
          as: "stats",
          attributes: [
            "hp_current",
            "hp_max",
            "stamina_current",
            "stamina_max",
            "attack_power",
            "defense",
            "move_speed",
            "attack_speed",
          ],
          required: false,
        },
      ],
    });

    const userStats = user?.stats ?? null;

    const hpCurrent = toNum(userStats?.hp_current, 100);
    const hpMax = toNum(userStats?.hp_max, 100);
    const staminaCurrent = toNum(userStats?.stamina_current, 0);
    const staminaMax = toNum(userStats?.stamina_max, 0);

    console.log(`[BOOTSTRAP] ✅ Stats: HP=${hpCurrent}/${hpMax} Stamina=${staminaCurrent}/${staminaMax}`);

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
      console.error(`[BOOTSTRAP] ❌ Instância inexistente: instanceId=${runtime.instance_id}`);
      return res.status(500).json({ message: "Instância inexistente (inconsistência)" });
    }

    if (instance.status !== "ONLINE") {
      console.warn(`[BOOTSTRAP] ⚠️ Instância não está ONLINE: status=${instance.status}`);
      return res.status(409).json({ message: "Instância não está ONLINE" });
    }

    const local = instance.local;
    if (!local) {
      console.error(`[BOOTSTRAP] ❌ Local inexistente: localId=${instance.local_id}`);
      return res.status(500).json({ message: "Local inexistente (inconsistência)" });
    }

    const sizeX = local.geometry?.size_x ?? 200;
    const sizeZ = local.geometry?.size_z ?? 200;

    const v = local.visual?.version ?? 1;
    const localTemplateVersion = `local:${local.id}:v${v}`;

    const groundMaterial = local.visual?.groundMaterial ?? null;
    const groundMesh = local.visual?.groundMesh ?? null;
    const groundRenderMaterial = local.visual?.groundRenderMaterial ?? null;
    const groundColor = groundRenderMaterial?.base_color ?? "#711010";

    console.log(`[BOOTSTRAP] ✅ Local: id=${local.id} code=${local.code} size=(${sizeX}, ${sizeZ})`);

    // =====================================
    // INVENTORY
    // =====================================
    const invRt = await ensureInventoryLoaded(userId);
    const inventory = buildInventoryFull(invRt);
    console.log(`[BOOTSTRAP] ✅ Inventory: ${inventory?.containers?.length ?? 0} containers`);

    // =====================================
    // ACTORS
    // =====================================
    console.log(`[BOOTSTRAP] 🔍 Carregando ACTORS para instanceId=${runtime.instance_id}`);
    const actors = await loadActorsForInstance(runtime.instance_id);
    console.log(`[BOOTSTRAP] ✅ ACTORS carregados: ${actors?.length ?? 0} atores`);

    clearActorsInstance(runtime.instance_id);
    for (const a of actors) {
      const aPos = {
        x: a.pos?.x ?? a.pos_x ?? 0,
        y: a.pos?.y ?? a.pos_y ?? 0,
        z: a.pos?.z ?? a.pos_z ?? 0,
      };
      console.log(`[BOOTSTRAP] ℹ️ Actor: id=${a.id} pos=(${aPos.x}, ${aPos.y}, ${aPos.z})`);
      
      addActor({
        id: a.id,
        instanceId: runtime.instance_id,
        pos: aPos,
        status: a.status ?? "ACTIVE",
        containers: a.containers ?? [],
      });
    }

    // =====================================
    // ENEMIES
    // =====================================
    console.log(`[BOOTSTRAP] 🔍 Carregando ENEMIES para instanceId=${runtime.instance_id}`);
    const enemies = await loadEnemiesForInstance(runtime.instance_id);
    console.log(`[BOOTSTRAP] ✅ ENEMIES carregados: ${enemies?.length ?? 0} inimigos`);

    clearEnemiesInstance(runtime.instance_id);
    for (const enemy of enemies) {
      const ePos = enemy.pos || { x: 0, z: 0 };
      console.log(`[BOOTSTRAP] ℹ️ Enemy: id=${enemy.id} displayName=${enemy.displayName} pos=(${ePos.x}, ${ePos.z}) status=${enemy.status}`);
      addEnemy(enemy);
    }

    console.log(`[BOOTSTRAP] 📦 Preparando payload de resposta para userId=${userId}`);

    const responsePayload = {
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

          // Compatibilidade e HUD imediata
          vitals: {
            hp: {
              current: hpCurrent,
              max: hpMax,
            },
            stamina: {
              current: staminaCurrent,
              max: staminaMax,
            },
          },

          connection_state: runtime.connection_state,
          disconnected_at: runtime.disconnected_at,
          offline_allowed_at: runtime.offline_allowed_at,
        },

        ui: {
          self: {
            vitals: {
              hp: {
                current: hpCurrent,
                max: hpMax,
              },
              stamina: {
                current: staminaCurrent,
                max: staminaMax,
              },
            },
          },
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
            ground_material: {
              id: groundMaterial?.id ?? null,
              code: groundMaterial?.code ?? "DEFAULT",
              name: groundMaterial?.name ?? "Default",
              friction: groundMaterial?.friction ?? null,
              restitution: groundMaterial?.restitution ?? null,
            },
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
            ground_color: groundColor,
            version: v,
          },
          debug: {
            bounds: { size_x: sizeX, size_z: sizeZ },
          },
        },

        actors,
      },

      inventory,
    };

    console.log(`[BOOTSTRAP] ✅ COMPLETO para userId=${userId}`);
    console.log(`[BOOTSTRAP] 📤 Resposta: ${actors.length} actors, ${enemies.length} enemies`);
    console.log(`${'='.repeat(80)}\n`);

    return res.json(responsePayload);
  } catch (error) {
    console.error("[BOOTSTRAP] ❌ Erro crítico:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

module.exports = { bootstrap };