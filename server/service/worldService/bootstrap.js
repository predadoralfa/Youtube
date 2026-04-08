"use strict";

const {
  GaUserRuntime,
  GaInstance,
  GaLocal,
  GaLocalGeometry,
  GaLocalVisual,
  GaMaterial,
  GaMeshTemplate,
  GaRenderMaterial,
  loadPlayerCombatStats,
  ensureInventoryLoaded,
  buildInventoryFull,
  ensureEquipmentLoaded,
  DEFAULT_LOCAL_VISUAL_VERSION,
  DEFAULT_GROUND_COLOR,
  getWorldClockBootstrap,
  ensureResearchLoaded,
  buildResearchPayload,
  loadPersistedAutoFoodConfig,
  loadActorsForInstance,
  addActor,
  clearActorsInstance,
  loadEnemiesForInstance,
  addEnemy,
  getEnemiesForInstance,
} = require("./dependencies");

const bootstrap = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`\n${"=".repeat(80)}`);
    console.log(`[BOOTSTRAP] iniciando para userId=${userId}`);
    console.log(`${"=".repeat(80)}`);

    const runtime = await GaUserRuntime.findOne({
      where: { user_id: userId },
      attributes: [
        "user_id",
        "instance_id",
        "pos_x",
        "pos_y",
        "pos_z",
        "yaw",
        "camera_pitch",
        "camera_distance",
        "connection_state",
        "disconnected_at",
        "offline_allowed_at",
      ],
    });

    if (!runtime) {
      console.error(`[BOOTSTRAP] Runtime ausente para userId=${userId}`);
      return res.status(500).json({ message: "Runtime ausente (inconsistencia)" });
    }

    console.log(
      `[BOOTSTRAP] Runtime carregado: instanceId=${runtime.instance_id} pos=(${runtime.pos_x}, ${runtime.pos_y}, ${runtime.pos_z})`
    );

    const combatStats = await loadPlayerCombatStats(userId);
    const hpCurrent = combatStats.hpCurrent;
    const hpMax = combatStats.hpMax;
    const staminaCurrent = combatStats.staminaCurrent;
    const staminaMax = combatStats.staminaMax;
    const hungerCurrent = combatStats.hungerCurrent;
    const hungerMax = combatStats.hungerMax;

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
      console.error(`[BOOTSTRAP] Instancia inexistente: instanceId=${runtime.instance_id}`);
      return res.status(500).json({ message: "Instancia inexistente (inconsistencia)" });
    }

    if (instance.status !== "ONLINE") {
      console.warn(`[BOOTSTRAP] Instancia nao esta ONLINE: status=${instance.status}`);
      return res.status(409).json({ message: "Instancia nao esta ONLINE" });
    }

    const local = instance.local;
    if (!local) {
      console.error(`[BOOTSTRAP] Local inexistente: localId=${instance.local_id}`);
      return res.status(500).json({ message: "Local inexistente (inconsistencia)" });
    }

    const sizeX = Number(local.geometry?.size_x);
    const sizeZ = Number(local.geometry?.size_z);
    if (!Number.isFinite(sizeX) || sizeX <= 0 || !Number.isFinite(sizeZ) || sizeZ <= 0) {
      console.error(
        `[BOOTSTRAP] Geometria invalida para localId=${local.id} sizeX=${local.geometry?.size_x} sizeZ=${local.geometry?.size_z}`
      );
      return res.status(500).json({ message: "Geometria do local invalida (inconsistencia)" });
    }

    const v = Number.isFinite(Number(local.visual?.version))
      ? Number(local.visual.version)
      : DEFAULT_LOCAL_VISUAL_VERSION;
    const localTemplateVersion = `local:${local.id}:v${v}`;

    const groundMaterial = local.visual?.groundMaterial ?? null;
    const groundMesh = local.visual?.groundMesh ?? null;
    const groundRenderMaterial = local.visual?.groundRenderMaterial ?? null;
    const groundColor = groundRenderMaterial?.base_color ?? DEFAULT_GROUND_COLOR;

    console.log(`[BOOTSTRAP] Local: id=${local.id} code=${local.code} size=(${sizeX}, ${sizeZ})`);

    const invRt = await ensureInventoryLoaded(userId);
    const eqRt = await ensureEquipmentLoaded(userId);
    const inventory = buildInventoryFull(invRt, eqRt);
    inventory.macro = {
      autoFood: await loadPersistedAutoFoodConfig(
        userId,
        Math.max(0, Number(hungerMax ?? 100) || 100)
      ),
    };
    const equipment = inventory.equipment;
    console.log(`[BOOTSTRAP] Inventory: ${inventory?.containers?.length ?? 0} containers`);

    console.log(`[BOOTSTRAP] Carregando ACTORS para instanceId=${runtime.instance_id}`);
    const actors = await loadActorsForInstance(runtime.instance_id);
    console.log(`[BOOTSTRAP] ACTORS carregados: ${actors?.length ?? 0} atores`);

    clearActorsInstance(runtime.instance_id);
    for (const a of actors) {
      const aPos = {
        x: a.pos?.x ?? a.pos_x ?? 0,
        y: a.pos?.y ?? a.pos_y ?? 0,
        z: a.pos?.z ?? a.pos_z ?? 0,
      };
      addActor({
        id: a.id,
        actorType: a.actorType,
        actorDefCode: a.actorDefCode ?? a.actorType,
        actorKind: a.actorKind ?? null,
        displayName: a.displayName ?? null,
        visualHint: a.visualHint ?? null,
        spawnId: a.spawnId ?? null,
        instanceId: runtime.instance_id,
        pos: aPos,
        status: a.status ?? "ACTIVE",
        rev: a.rev ?? 0,
        state: a.state ?? null,
        containers: a.containers ?? [],
        lootSummary: a.lootSummary ?? null,
      });
    }

    console.log(`[BOOTSTRAP] Carregando ENEMIES para instanceId=${runtime.instance_id}`);
    let enemyCount = 0;
    const cachedEnemies = getEnemiesForInstance(runtime.instance_id);
    if (cachedEnemies.length > 0) {
      enemyCount = cachedEnemies.length;
      console.log(`[BOOTSTRAP] ENEMIES ja estavam carregados em memoria: ${cachedEnemies.length} inimigos`);
    } else {
      const enemies = await loadEnemiesForInstance(runtime.instance_id);
      enemyCount = enemies?.length ?? 0;
      console.log(`[BOOTSTRAP] ENEMIES carregados: ${enemies?.length ?? 0} inimigos`);

      for (const enemy of enemies) {
        addEnemy(enemy);
      }
    }

    const worldClock = await getWorldClockBootstrap();
    const research = await ensureResearchLoaded(userId);

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
          cameraPitch: Number(runtime.camera_pitch ?? Math.PI / 4),
          cameraDistance: Number(runtime.camera_distance ?? 26),
          vitals: {
            hp: {
              current: hpCurrent,
              max: hpMax,
            },
            stamina: {
              current: staminaCurrent,
              max: staminaMax,
            },
            hunger: {
              current: hungerCurrent,
              max: hungerMax,
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
              hunger: {
                current: hungerCurrent,
                max: hungerMax,
              },
            },
          },
        },
        research: buildResearchPayload({ research }),
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
        worldClock,
        actors,
      },
      inventory,
      equipment,
    };

    console.log(`[BOOTSTRAP] COMPLETO para userId=${userId}`);
    console.log(`[BOOTSTRAP] Resposta: ${actors.length} actors, ${enemyCount} enemies`);
    console.log(`${"=".repeat(80)}\n`);

    return res.json(responsePayload);
  } catch (error) {
    console.error("[BOOTSTRAP] Erro critico:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

module.exports = {
  bootstrap,
};
