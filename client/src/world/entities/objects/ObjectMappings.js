export function normalizeObjectAssetKey(assetKey) {
  const raw = String(assetKey ?? "").trim().toUpperCase();

  switch (raw) {
    case "DECOR_ROCK_01":
    case "DECOR_ROCK_02":
    case "ROCK":
      return "ROCK";
    case "EDITOR_CHARACTER":
      return "EDITOR_CHARACTER";
    case "WOOD_BENCH_01":
      return "WOOD_BENCH_01";
    case "LAMP_POST_01":
      return "LAMP_POST_01";
    default:
      return raw || "DEFAULT";
  }
}

export function getObjectDisplayColor(assetKey) {
  switch (normalizeObjectAssetKey(assetKey)) {
    case "ROCK":
      return 0x7c7c7c;
    case "EDITOR_CHARACTER":
      return 0x59c5ff;
    case "WOOD_BENCH_01":
      return 0x8a5a2b;
    case "LAMP_POST_01":
      return 0xd9d6cf;
    default:
      return 0x808080;
  }
}
