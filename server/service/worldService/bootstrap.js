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
  loadActiveCraftDefs,
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
const { loadSpeedFromStats } = require("../../state/runtime/loader/queries");
const { getProceduralMapProfile } = require("../../config/mapProceduralProfiles");

function safePretty(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "[unserializable]";
  }
}

function logBootstrapPlayer({
  userId,
  displayName,
  combatStats,
  speed,
  instance,
}) {
  const payload = {
    player: {
      id: Number(userId),
      name: displayName ?? null,
    },
    stats: combatStats
      ? {
          hp_current: combatStats.hpCurrent,
          hp_max: combatStats.hpMax,
          stamina_current: combatStats.staminaCurrent,
          stamina_max: combatStats.staminaMax,
          hunger_current: combatStats.hungerCurrent,
          hunger_max: combatStats.hungerMax,
          thirst_current: combatStats.thirstCurrent,
          thirst_max: combatStats.thirstMax,
          immunity_current: combatStats.immunityCurrent,
          immunity_max: combatStats.immunityMax,
          immunity_percent: combatStats.immunityPercent,
          disease_level: combatStats.diseaseLevel,
          disease_severity: combatStats.diseaseSeverity,
          sleep_current: combatStats.sleepCurrent,
          sleep_max: combatStats.sleepMax,
          attack_power: combatStats.attackPower,
          defense: combatStats.defense,
          attack_speed: combatStats.attackSpeed,
          attack_range: combatStats.attackRange,
          move_speed: speed,
        }
      : null,
    world: {
      instance: instance
        ? {
            id: instance.id,
            local_id: instance.local_id,
            instance_type: instance.instance_type,
            status: instance.status,
          }
        : null,
    },
  };

  console.log(`[BOOTSTRAP][PLAYER ${Number(userId)}] ${displayName ?? "Unknown"}`);
  console.log(safePretty(payload));
}

const bootstrap = async (req, res) => {
  try {
    const userId = req.user.id;
    const displayName = req.user.display_name?.trim() || `User ${userId}`;

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

    const combatStats = await loadPlayerCombatStats(userId);
    const speed = await loadSpeedFromStats(userId);
    if (speed == null) {
      console.error(`[BOOTSTRAP] move_speed ausente para userId=${userId}`);
      return res.status(500).json({ message: "Velocidade de movimento ausente no banco de dados" });
    }
    const hpCurrent = combatStats.hpCurrent;
    const hpMax = combatStats.hpMax;
    const staminaCurrent = combatStats.staminaCurrent;
    const staminaMax = combatStats.staminaMax;
    const hungerCurrent = combatStats.hungerCurrent;
    const hungerMax = combatStats.hungerMax;
    const thirstCurrent = combatStats.thirstCurrent;
    const thirstMax = combatStats.thirstMax;
    const immunityCurrent = combatStats.immunityCurrent;
    const immunityMax = combatStats.immunityMax;
    const immunityPercent = combatStats.immunityPercent;
    const diseaseLevel = combatStats.diseaseLevel;
    const diseaseSeverity = combatStats.diseaseSeverity;
    const sleepCurrent = combatStats.sleepCurrent;
    const sleepMax = combatStats.sleepMax;

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

    const research = await ensureResearchLoaded(userId);
    const invRt = await ensureInventoryLoaded(userId);
    invRt.research = research;
    invRt.craftDefs = await loadActiveCraftDefs();
    const eqRt = await ensureEquipmentLoaded(userId);
    const inventory = buildInventoryFull(invRt, eqRt);
    inventory.macro = {
      autoFood: await loadPersistedAutoFoodConfig(
        userId,
        Math.max(0, Number(hungerMax ?? 100) || 100)
      ),
    };
    const equipment = inventory.equipment;
    const actors = await loadActorsForInstance(runtime.instance_id);

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
    } else {
      const enemies = await loadEnemiesForInstance(runtime.instance_id);
      enemyCount = enemies?.length ?? 0;

      for (const enemy of enemies) {
        addEnemy(enemy);
      }
    }

    const worldClock = await getWorldClockBootstrap();

    logBootstrapPlayer({
      userId,
      displayName,
      instance,
      combatStats,
      speed,
      local,
      worldClock,
    });

    const responsePayload = {
      ok: true,
      snapshot: {
        runtime: {
          user_id: runtime.user_id,
          instance_id: runtime.instance_id,
          rev: Number(runtime.rev ?? 0),
          speed,
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
            thirst: {
              current: thirstCurrent,
              max: thirstMax,
            },
          },
          status: {
            immunity: {
              current: immunityCurrent,
              max: immunityMax,
              percent: immunityPercent,
            },
            fever: {
              current: diseaseLevel,
              max: 100,
              percent: Math.round((Math.min(diseaseLevel, 100) / 100) * 100000) / 1000,
              severity: diseaseSeverity,
              active: diseaseLevel > 0,
            },
            debuffs: combatStats.debuffs ?? null,
            sleep: {
              current: sleepCurrent,
              max: sleepMax,
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
              thirst: {
                current: thirstCurrent,
                max: thirstMax,
              },
            },
            status: {
              immunity: {
                current: immunityCurrent,
                max: immunityMax,
                percent: immunityPercent,
              },
            fever: {
              current: diseaseLevel,
              max: 100,
              percent: Math.round((Math.min(diseaseLevel, 100) / 100) * 100000) / 1000,
              severity: diseaseSeverity,
              active: diseaseLevel > 0,
            },
              debuffs: combatStats.debuffs ?? null,
              sleep: {
                current: sleepCurrent,
                max: sleepMax,
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
        proceduralMap: getProceduralMapProfile(instance.id) ?? getProceduralMapProfile(local.id),
        worldClock,
        actors,
      },
      inventory,
      equipment,
    };

    return res.json(responsePayload);
  } catch (error) {
    console.error("[BOOTSTRAP] Erro critico:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
};

module.exports = {
  bootstrap,
};
