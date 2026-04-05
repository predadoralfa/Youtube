"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("ga_world_month_def", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },

      code: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },

      name: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      mood: {
        type: Sequelize.STRING(80),
        allowNull: true,
      },

      season: {
        type: Sequelize.STRING(40),
        allowNull: false,
      },

      order_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      days_in_month: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 30,
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    });

    await queryInterface.addConstraint("ga_world_month_def", {
      fields: ["code"],
      type: "unique",
      name: "uq_ga_world_month_def_code",
    });

    await queryInterface.addConstraint("ga_world_month_def", {
      fields: ["order_index"],
      type: "unique",
      name: "uq_ga_world_month_def_order_index",
    });

    await queryInterface.addIndex("ga_world_month_def", ["is_active"], {
      name: "ix_ga_world_month_def_is_active",
    });

    await queryInterface.bulkInsert("ga_world_month_def", [
      {
        code: "FROSTREIGN",
        name: "Frostreign",
        description: "O reinado do gelo. Estradas tornam-se perigosas e apenas os preparados conseguem avancar.",
        mood: "rigor",
        season: "winter",
        order_index: 1,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "EMBERWAKE",
        name: "Emberwake",
        description: "Brasas ocultas despertam sob o frio. Forjas trabalham sem descanso e a resistencia e testada.",
        mood: "resistencia",
        season: "winter",
        order_index: 2,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "THAWMARK",
        name: "Thawmark",
        description: "O degelo comeca a marcar a terra. Rios transbordam e caminhos mudam constantemente.",
        mood: "instabilidade",
        season: "transition",
        order_index: 3,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "GREENSWELL",
        name: "Greenswell",
        description: "A vida retorna com forca. Campos florescem e novos ciclos tem inicio.",
        mood: "renovacao",
        season: "spring",
        order_index: 4,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "SUNCREST",
        name: "Suncrest",
        description: "O sol alcanca seu auge. Trabalho, comercio e producao atingem seu melhor momento.",
        mood: "prosperidade",
        season: "summer",
        order_index: 5,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "SKYLIGHT",
        name: "Skylight",
        description: "Ceus limpos favorecem longas viagens e acordos entre povos distantes.",
        mood: "clareza",
        season: "summer",
        order_index: 6,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "WARHALLOW",
        name: "Warhallow",
        description: "Periodo sagrado da guerra. Conflitos, campanhas e provas de honra dominam o mundo.",
        mood: "conflito",
        season: "summer",
        order_index: 7,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "ASHWIND",
        name: "Ashwind",
        description: "Ventos carregam as cinzas do que foi perdido. O cansaco se espalha apos os conflitos.",
        mood: "esgotamento",
        season: "late_summer",
        order_index: 8,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "RAVENFALL",
        name: "Ravenfall",
        description: "Nevoas cobrem a terra. Segredos, pressagios e intrigas tornam-se comuns.",
        mood: "intriga",
        season: "autumn",
        order_index: 9,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "HARVESTTIDE",
        name: "Harvesttide",
        description: "A colheita final do ano. Estoques sao formados e decisoes importantes sao tomadas.",
        mood: "encerramento",
        season: "autumn",
        order_index: 10,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "DUSKVEIL",
        name: "Duskveil",
        description: "O veu do crepusculo se fecha. O frio retorna e a preparacao para o inverno comeca.",
        mood: "preparacao",
        season: "pre_winter",
        order_index: 11,
        days_in_month: 30,
        is_active: true,
      },
      {
        code: "DEEPNIGHT",
        name: "Deepnight",
        description: "Noites longas dominam o mundo. Historias sao contadas, rituais acontecem e o destino e lembrado.",
        mood: "introspeccao",
        season: "winter",
        order_index: 12,
        days_in_month: 30,
        is_active: true,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("ga_world_month_def", "ix_ga_world_month_def_is_active").catch(() => {});
    await queryInterface.removeConstraint("ga_world_month_def", "uq_ga_world_month_def_order_index").catch(() => {});
    await queryInterface.removeConstraint("ga_world_month_def", "uq_ga_world_month_def_code").catch(() => {});
    await queryInterface.dropTable("ga_world_month_def");
  },
};
