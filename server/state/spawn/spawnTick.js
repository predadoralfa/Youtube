// server/state/spawn/spawnTick.js

const db = require("../../models");
const { getAliveEnemiesForSpawnPoint, getAliveEnemiesForSpawnEntry, addEnemy } = require("../enemies/enemiesRuntimeStore");
const { emitEnemySpawn } = require("../enemies/enemyEmit");

/**
 * Utilities de posição
 */
function generatePointPos(baseX, baseZ) {
  // POINT: nasce exatamente no ponto
  return { x: Number(baseX), z: Number(baseZ) };
}

function generateCirclePos(baseX, baseZ, radius) {
  // CIRCLE: posição aleatória dentro do raio
  const r = Number(radius) || 1;
  const angle = Math.random() * 2 * Math.PI;
  const dist = Math.random() * r;
  return {
    x: Number(baseX) + dist * Math.cos(angle),
    z: Number(baseZ) + dist * Math.sin(angle),
  };
}

/**
 * Seleciona entry por weight (sorteio ponderado)
 */
function selectWeightedEntry(candidateEntries) {
  if (!candidateEntries || candidateEntries.length === 0) return null;

  const totalWeight = candidateEntries.reduce((sum, e) => sum + (Number(e.weight) || 1), 0);
  if (totalWeight <= 0) return null;

  let random = Math.random() * totalWeight;
  for (const entry of candidateEntries) {
    const w = Number(entry.weight) || 1;
    if (random < w) return entry;
    random -= w;
  }

  return candidateEntries[0]; // fallback
}

/**
 * Determina quantidade a spawnar
 */
function determineSpawnQuantity(entry, remainingCapacity) {
  const qMin = Number(entry.quantity_min) || 1;
  const qMax = Number(entry.quantity_max) || 1;
  const desired = Math.floor(Math.random() * (qMax - qMin + 1)) + qMin;
  return Math.min(desired, Math.max(0, remainingCapacity));
}

/**
 * Um tick de spawn: processa todos os spawners ATIVOS
 * e cria inimigos conforme regras
 */
async function spawnTick(nowMs, io = null) {
  try {
    console.log("[SPAWN_TICK] iniciando...");
    
    // Carregar spawners ATIVOS com suas entries
    const spawners = await db.GaSpawnPoint.findAll({
      where: {
        status: "ACTIVE",
      },
      include: [
        {
          association: "entries",
          where: { status: "ACTIVE" },
          required: false, // LEFT JOIN, não perde spawner sem entries
        },
        {
          association: "instance",
          attributes: ["id"],
          required: false,
        },
      ],
    });

    console.log(`[SPAWN_TICK] encontrados ${spawners?.length ?? 0} spawners ATIVOS`);

    if (!spawners || spawners.length === 0) {
      console.log("[SPAWN_TICK] nenhum spawner ativo no banco");
      return; // nenhum spawner ativo
    }

    // Processa cada spawner
    for (const spawner of spawners) {
      try {
        console.log(`[SPAWN_TICK] processando spawner=${spawner.id} entries=${spawner.entries?.length ?? 0}`);
        await processSpawner(spawner, nowMs, io);
      } catch (err) {
        console.error(`[SPAWN] Error processing spawner=${spawner.id}:`, err);
      }
    }
    
    console.log("[SPAWN_TICK] concluído");
  } catch (err) {
    console.error("[SPAWN] spawnTick error:", err);
  }
}

/**
 * Processa um spawner específico
 */
async function processSpawner(spawner, nowMs, io = null) {
  const spawnPointId = spawner.id;
  
  // ✨ CORRIGIDO: Obter instanceId do spawner
  // O spawner foi carregado com instance (via include)
  const instanceId = spawner.instance?.id ?? spawner.instance_id;
  
  if (!instanceId) {
    console.warn(`[SPAWN] ERROR: spawner=${spawnPointId} SEM INSTANCE_ID! Pulando.`);
    return; // Não pode spawnar sem saber em qual instância
  }

  const maxAlive = Number(spawner.max_alive) || 1;

  // Conta vivos atuais (do runtime store)
  const aliveEnemies = getAliveEnemiesForSpawnPoint(spawnPointId);
  const aliveCount = aliveEnemies.length;

  console.log(`[SPAWN] spawner=${spawnPointId} instanceId=${instanceId} vivos=${aliveCount} max=${maxAlive}`);

  // Se já atingiu limite, não spawna
  if (aliveCount >= maxAlive) {
    console.log(`[SPAWN] spawner=${spawnPointId} JÁ NO LIMITE (${aliveCount}/${maxAlive})`);
    return;
  }

  // Entries ativas carregadas no include
  const entries = spawner.entries || [];
  if (entries.length === 0) {
    console.log(`[SPAWN] spawner=${spawnPointId} SEM ENTRIES ATIVAS`);
    return; // nenhuma entrada de spawn
  }

  console.log(`[SPAWN] spawner=${spawnPointId} entries disponíveis=${entries.length}`);

  // Filtra entries que ainda têm capacidade (alive_limit)
  const candidateEntries = [];
  for (const entry of entries) {
    const aliveLimit = entry.alive_limit;

    // Se não tem alive_limit, entry está disponível
    if (aliveLimit == null) {
      candidateEntries.push(entry);
      continue;
    }

    // Se tem alive_limit, verifica quantos daquele tipo estão vivos
    const aliveOfType = getAliveEnemiesForSpawnEntry(spawnPointId, entry.id);
    if (aliveOfType.length < Number(aliveLimit)) {
      candidateEntries.push(entry);
    }
  }

  if (candidateEntries.length === 0) {
    console.log(`[SPAWN] spawner=${spawnPointId} todas as entries atingiram limite`);
    return; // todas as entries atingiram limite
  }

  console.log(`[SPAWN] spawner=${spawnPointId} candidatos=${candidateEntries.length}`);

  // Seleciona entry por weight
  const selectedEntry = selectWeightedEntry(candidateEntries);
  if (!selectedEntry) {
    console.log(`[SPAWN] spawner=${spawnPointId} erro ao selecionar entry`);
    return;
  }

  console.log(`[SPAWN] spawner=${spawnPointId} selecionada entry=${selectedEntry.id} enemyDefId=${selectedEntry.enemy_def_id}`);

  // Determina quantidade a spawnar
  const remainingCapacity = maxAlive - aliveCount;
  const spawnCount = determineSpawnQuantity(selectedEntry, remainingCapacity);

  console.log(`[SPAWN] spawner=${spawnPointId} spawnCount=${spawnCount} remainingCapacity=${remainingCapacity}`);

  if (spawnCount <= 0) {
    console.log(`[SPAWN] spawner=${spawnPointId} spawnCount inválido`);
    return;
  }

  // Carrega enemyDef e stats template
  const enemyDef = await db.GaEnemyDef.findByPk(selectedEntry.enemy_def_id, {
    include: [
      {
        association: "baseStats",
        attributes: ["hp_max", "move_speed", "attack_speed"],
      },
    ],
  });

  if (!enemyDef || !enemyDef.baseStats) {
    console.warn(
      `[SPAWN] enemyDef=${selectedEntry.enemy_def_id} ou stats não encontrados`
    );
    return;
  }

  const baseStats = enemyDef.baseStats;
  const shapeKind = String(spawner.shape_kind || "POINT");
  const spawnX = Number(spawner.pos_x);
  const spawnZ = Number(spawner.pos_z);
  const radius = Number(spawner.radius) || 1;

  console.log(`[SPAWN] spawner=${spawnPointId} criando ${spawnCount} inimigos do tipo ${enemyDef.code}`);

  // Cria instâncias
  for (let i = 0; i < spawnCount; i++) {
    try {
      // Gera posição
      const spawnPos =
        shapeKind === "CIRCLE"
          ? generateCirclePos(spawnX, spawnZ, radius)
          : generatePointPos(spawnX, spawnZ);

      // Cria ga_enemy_instance
      // ⚠️ NÃO inserir instance_id - é derivado de spawn_point_id → spawn_point.instance_id
      const enemyInstance = await db.GaEnemyInstance.create(
        {
          spawn_point_id: spawnPointId,
          spawn_entry_id: selectedEntry.id,
          enemy_def_id: enemyDef.id,
          status: "ALIVE",
          pos_x: spawnPos.x,
          pos_z: spawnPos.z,
          yaw: 0,
          home_x: spawnPos.x,
          home_z: spawnPos.z,
          spawned_at: new Date(nowMs),
        },
        {
          returning: true,
        }
      );

      // Cria ga_enemy_instance_stats
      await db.GaEnemyInstanceStats.create({
        enemy_instance_id: enemyInstance.id,
        hp_current: Number(baseStats.hp_max),
        hp_max: Number(baseStats.hp_max),
        move_speed: Number(baseStats.move_speed),
        attack_speed: Number(baseStats.attack_speed),
      });

      // ✨ CORRIGIDO: Usar instanceId correto do spawner
      const enemyRuntimeData = {
        id: enemyInstance.id,
        instanceId: String(instanceId),  // ✨ CORRIGIDO: Usar instanceId obtido do spawner
        spawnPointId: spawnPointId,
        spawnEntryId: selectedEntry.id,
        enemyDefId: enemyDef.id,
        enemyDefCode: enemyDef.code,
        displayName: enemyDef.name || enemyDef.code,
        pos: {
          x: Number(enemyInstance.pos_x),
          z: Number(enemyInstance.pos_z),
        },
        yaw: Number(enemyInstance.yaw),
        homePos: {
          x: Number(enemyInstance.home_x),
          z: Number(enemyInstance.home_z),
        },
        status: "ALIVE",
        stats: {
          hpCurrent: Number(baseStats.hp_max),
          hpMax: Number(baseStats.hp_max),
          moveSpeed: Number(baseStats.move_speed),
          attackSpeed: Number(baseStats.attack_speed),
        },
        rev: 0,
        dirty: false,
      };

      // Adiciona ao runtime store
      addEnemy(enemyRuntimeData);

      // ✨ NOVO: Emite spawn para todos na instância
      if (io) {
        emitEnemySpawn(io, enemyRuntimeData);
      }

      console.log(`[SPAWN] ✅ created enemy=${enemyInstance.id} spawner=${spawnPointId} type=${enemyDef.code} pos=(${spawnPos.x.toFixed(2)},${spawnPos.z.toFixed(2)}) instanceId=${instanceId} [EMITTED]`);
    } catch (err) {
      console.error(
        `[SPAWN] Error creating enemy for spawner=${spawnPointId} entry=${selectedEntry.id}:`,
        err
      );
    }
  }
}

module.exports = {
  spawnTick,
};