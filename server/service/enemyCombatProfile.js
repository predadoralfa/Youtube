function readEnemyAttackPower(profile, fallback = 5) {
  let data = profile;

  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      data = null;
    }
  }

  const candidates = [
    data?.attackPower,
    data?.attack_power,
    data?.attackpower,
    data?.combat?.attackPower,
    data?.combat?.attack_power,
    data?.stats?.attackPower,
    data?.stats?.attack_power,
  ];

  for (const candidate of candidates) {
    const n = Number(candidate);
    if (Number.isFinite(n) && n > 0) return n;
  }

  return fallback;
}

module.exports = {
  readEnemyAttackPower,
};
