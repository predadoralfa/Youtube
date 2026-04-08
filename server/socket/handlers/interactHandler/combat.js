"use strict";

function startEnemyCombat({ enemy, attackerUserId, rt }) {
  if (!enemy) return false;

  if (rt?.combat) {
    rt.combat.state = "ENGAGED";
    rt.combat.targetId = enemy.id;
    rt.combat.targetKind = "ENEMY";
    console.log(
      `[INTERACT_DEBUG] Combat armed | player=${attackerUserId} enemy=${enemy.id} ` +
        `attackRange=${Number(rt.combat?.attackRange ?? 1.2).toFixed(2)} attackSpeed=${Number(
          rt.combat?.attackSpeed ?? 1
        ).toFixed(2)}`
    );
  }

  return true;
}

module.exports = {
  startEnemyCombat,
};
