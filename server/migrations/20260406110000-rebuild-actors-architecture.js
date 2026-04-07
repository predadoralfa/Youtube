"use strict";

const TREE_POSITIONS = [
  { x: 27, y: 0, z: 18 },
  { x: 31, y: 0, z: 18 },
  { x: 35, y: 0, z: 18 },
];

async function findReusableLootContainerDef(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id, code, slot_count
    FROM ga_container_def
    WHERE code IN ('LOOT_CONTAINER', 'Stone Container', 'CHEST_10')
    ORDER BY FIELD(code, 'LOOT_CONTAINER', 'Stone Container', 'CHEST_10')
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0] ?? null;
}

async function findAppleItemDefId(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_item_def
    WHERE code = 'FOOD-APPLE'
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0]?.id ?? null;
}

async function findAnyUserId(queryInterface, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
    SELECT id
    FROM ga_user
    ORDER BY id ASC
    LIMIT 1
    `,
    { transaction }
  );

  return rows?.[0]?.id ?? null;
}

async function cleanupLegacyActorData(queryInterface, Sequelize, transaction) {
  const [ownerRows] = await queryInterface.sequelize.query(
    `
    SELECT container_id
    FROM ga_container_owner
    WHERE owner_kind = 'ACTOR'
    `,
    { transaction }
  );

  const containerIds = ownerRows
    .map((row) => Number(row.container_id))
    .filter(Number.isInteger);

  if (containerIds.length > 0) {
    const [slotRows] = await queryInterface.sequelize.query(
      `
      SELECT item_instance_id
      FROM ga_container_slot
      WHERE container_id IN (${containerIds.join(",")})
        AND item_instance_id IS NOT NULL
      `,
      { transaction }
    );

    const itemInstanceIds = slotRows
      .map((row) => Number(row.item_instance_id))
      .filter(Number.isInteger);

    await queryInterface.bulkDelete(
      "ga_container_slot",
      { container_id: { [Sequelize.Op.in]: containerIds } },
      { transaction }
    );

    await queryInterface.bulkDelete(
      "ga_container_owner",
      { container_id: { [Sequelize.Op.in]: containerIds } },
      { transaction }
    );

    await queryInterface.bulkDelete(
      "ga_container",
      { id: { [Sequelize.Op.in]: containerIds } },
      { transaction }
    );

    if (itemInstanceIds.length > 0) {
      await queryInterface.bulkDelete(
        "ga_item_instance",
        { id: { [Sequelize.Op.in]: itemInstanceIds } },
        { transaction }
      );
    }
  }

  await queryInterface.dropTable("ga_actor", { transaction }).catch(() => {});
  await queryInterface.dropTable("ga_actor_spawn", { transaction }).catch(() => {});
  await queryInterface.dropTable("ga_actor_def", { transaction }).catch(() => {});
}

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const lootContainerDef = await findReusableLootContainerDef(queryInterface, transaction);

      await cleanupLegacyActorData(queryInterface, Sequelize, transaction);

      await queryInterface.createTable(
        "ga_actor_def",
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          code: {
            type: Sequelize.STRING(64),
            allowNull: false,
            unique: true,
          },
          name: {
            type: Sequelize.STRING(128),
            allowNull: false,
          },
          actor_kind: {
            type: Sequelize.STRING(64),
            allowNull: false,
          },
          visual_hint: {
            type: Sequelize.STRING(64),
            allowNull: true,
          },
          default_state_json: {
            type: Sequelize.JSON,
            allowNull: true,
          },
          default_container_def_id: {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
              model: "ga_container_def",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );

      await queryInterface.createTable(
        "ga_actor_spawn",
        {
          id: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          instance_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "ga_instance",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
          },
          actor_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "ga_actor_def",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          pos_x: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          pos_y: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          pos_z: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          state_override_json: {
            type: Sequelize.JSON,
            allowNull: true,
          },
          is_active: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true,
          },
          rev: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 1,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );

      await queryInterface.createTable(
        "ga_actor",
        {
          id: {
            type: Sequelize.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
          },
          actor_def_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "ga_actor_def",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          actor_spawn_id: {
            type: Sequelize.BIGINT,
            allowNull: true,
            references: {
              model: "ga_actor_spawn",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
          },
          instance_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: {
              model: "ga_instance",
              key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
          },
          pos_x: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          pos_y: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          pos_z: {
            type: Sequelize.DECIMAL(10, 3),
            allowNull: false,
            defaultValue: 0,
          },
          state_json: {
            type: Sequelize.JSON,
            allowNull: true,
          },
          status: {
            type: Sequelize.ENUM("ACTIVE", "DISABLED"),
            allowNull: false,
            defaultValue: "ACTIVE",
          },
          rev: {
            type: Sequelize.BIGINT,
            allowNull: false,
            defaultValue: 1,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );

      await queryInterface.addIndex("ga_actor_def", ["code"], {
        name: "ga_actor_def_code",
        unique: true,
        transaction,
      });
      await queryInterface.addIndex("ga_actor_spawn", ["instance_id"], {
        name: "ga_actor_spawn_instance_id",
        transaction,
      });
      await queryInterface.addIndex("ga_actor_spawn", ["actor_def_id"], {
        name: "ga_actor_spawn_actor_def_id",
        transaction,
      });
      await queryInterface.addIndex("ga_actor", ["actor_def_id"], {
        name: "ga_actor_actor_def_id",
        transaction,
      });
      await queryInterface.addIndex("ga_actor", ["actor_spawn_id"], {
        name: "ga_actor_actor_spawn_id",
        transaction,
      });
      await queryInterface.addIndex("ga_actor", ["instance_id"], {
        name: "ga_actor_instance_id",
        transaction,
      });

      const now = new Date();

      await queryInterface.bulkInsert(
        "ga_actor_def",
        [
          {
            code: "TREE_APPLE",
            name: "Apple Tree",
            actor_kind: "RESOURCE_NODE",
            visual_hint: "TREE",
            default_state_json: JSON.stringify({
              resourceType: "APPLE_TREE",
              visualHint: "TREE",
            }),
            default_container_def_id: lootContainerDef?.id ?? null,
            is_active: true,
            created_at: now,
            updated_at: now,
          },
          {
            code: "CHEST_TEST",
            name: "Chest",
            actor_kind: "OBJECT",
            visual_hint: "CHEST",
            default_state_json: JSON.stringify({
              visualHint: "CHEST",
            }),
            default_container_def_id: lootContainerDef?.id ?? null,
            is_active: true,
            created_at: now,
            updated_at: now,
          },
          {
            code: "ROCK_NODE_SMALL",
            name: "Rock Node",
            actor_kind: "RESOURCE_NODE",
            visual_hint: "ROCK",
            default_state_json: JSON.stringify({
              resourceType: "ROCK_NODE_SMALL",
              visualHint: "ROCK",
            }),
            default_container_def_id: lootContainerDef?.id ?? null,
            is_active: true,
            created_at: now,
            updated_at: now,
          },
          {
            code: "GROUND_LOOT",
            name: "Ground Loot",
            actor_kind: "LOOT",
            visual_hint: "DEFAULT",
            default_state_json: JSON.stringify({
              visualHint: "DEFAULT",
            }),
            default_container_def_id: lootContainerDef?.id ?? null,
            is_active: true,
            created_at: now,
            updated_at: now,
          },
        ],
        { transaction }
      );

      const [actorDefRows] = await queryInterface.sequelize.query(
        `
        SELECT id, code, default_state_json, default_container_def_id
        FROM ga_actor_def
        `,
        { transaction }
      );

      const actorDefByCode = new Map(actorDefRows.map((row) => [String(row.code), row]));
      const treeActorDef = actorDefByCode.get("TREE_APPLE");

      if (treeActorDef) {
        await queryInterface.bulkInsert(
          "ga_actor_spawn",
          TREE_POSITIONS.map((pos) => ({
            instance_id: 6,
            actor_def_id: Number(treeActorDef.id),
            pos_x: pos.x,
            pos_y: pos.y,
            pos_z: pos.z,
            state_override_json: null,
            is_active: true,
            rev: 1,
            created_at: now,
            updated_at: now,
          })),
          { transaction }
        );

        const [spawnRows] = await queryInterface.sequelize.query(
          `
          SELECT id, instance_id, actor_def_id, pos_x, pos_y, pos_z
          FROM ga_actor_spawn
          WHERE actor_def_id = ${Number(treeActorDef.id)}
            AND instance_id = 6
          ORDER BY id ASC
          `,
          { transaction }
        );

        await queryInterface.bulkInsert(
          "ga_actor",
          spawnRows.map((spawnRow) => ({
            actor_def_id: Number(spawnRow.actor_def_id),
            actor_spawn_id: Number(spawnRow.id),
            instance_id: Number(spawnRow.instance_id),
            pos_x: Number(spawnRow.pos_x),
            pos_y: Number(spawnRow.pos_y),
            pos_z: Number(spawnRow.pos_z),
            state_json: treeActorDef.default_state_json,
            status: "ACTIVE",
            rev: 1,
            created_at: now,
            updated_at: now,
          })),
          { transaction }
        );

        if (lootContainerDef?.id) {
          const [actorRows] = await queryInterface.sequelize.query(
            `
            SELECT id, actor_spawn_id
            FROM ga_actor
            WHERE actor_def_id = ${Number(treeActorDef.id)}
              AND instance_id = 6
            ORDER BY id ASC
            `,
            { transaction }
          );

          const ownerUserId = await findAnyUserId(queryInterface, transaction);
          const appleItemDefId = await findAppleItemDefId(queryInterface, transaction);

          for (const actorRow of actorRows) {
            await queryInterface.bulkInsert(
              "ga_container",
              [
                {
                  container_def_id: Number(lootContainerDef.id),
                  slot_role: "LOOT",
                  state: "ACTIVE",
                  rev: 1,
                  created_at: now,
                  updated_at: now,
                },
              ],
              { transaction }
            );

            const [containerRows] = await queryInterface.sequelize.query(
              `
              SELECT id
              FROM ga_container
              WHERE container_def_id = ${Number(lootContainerDef.id)}
                AND slot_role = 'LOOT'
              ORDER BY id DESC
              LIMIT 1
              `,
              { transaction }
            );

            const containerId = containerRows?.[0]?.id ?? null;
            if (!containerId) continue;

            await queryInterface.bulkInsert(
              "ga_container_owner",
              [
                {
                  container_id: Number(containerId),
                  owner_kind: "ACTOR",
                  owner_id: Number(actorRow.id),
                  slot_role: "LOOT",
                  created_at: now,
                  updated_at: now,
                },
              ],
              { transaction }
            );

            const emptySlots = Array.from({ length: Number(lootContainerDef.slot_count ?? 0) }, (_, index) => ({
              container_id: Number(containerId),
              slot_index: index,
              item_instance_id: null,
              qty: 0,
            }));

            if (emptySlots.length > 0) {
              await queryInterface.bulkInsert("ga_container_slot", emptySlots, { transaction });
            }

            if (!ownerUserId || !appleItemDefId) continue;

            await queryInterface.bulkInsert(
              "ga_item_instance",
              [
                {
                  item_def_id: Number(appleItemDefId),
                  owner_user_id: Number(ownerUserId),
                  bind_state: "NONE",
                  durability: null,
                  props_json: JSON.stringify({
                    sourceActorId: Number(actorRow.id),
                    sourceType: "APPLE_TREE",
                  }),
                  created_at: now,
                  updated_at: now,
                },
              ],
              { transaction }
            );

            const [itemRows] = await queryInterface.sequelize.query(
              `
              SELECT id
              FROM ga_item_instance
              WHERE item_def_id = ${Number(appleItemDefId)}
                AND owner_user_id = ${Number(ownerUserId)}
              ORDER BY id DESC
              LIMIT 1
              `,
              { transaction }
            );

            const itemInstanceId = itemRows?.[0]?.id ?? null;
            if (!itemInstanceId) continue;

            await queryInterface.bulkUpdate(
              "ga_container_slot",
              {
                item_instance_id: Number(itemInstanceId),
                qty: 5,
              },
              {
                container_id: Number(containerId),
                slot_index: 0,
              },
              { transaction }
            );
          }
        }
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await cleanupLegacyActorData(queryInterface, queryInterface.sequelize.Sequelize, transaction);
    });
  },
};
