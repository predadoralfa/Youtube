export function normalizeActorType(actorType) {
  const raw = String(actorType ?? "").trim().toUpperCase();

  switch (raw) {
    case "BAU":
    case "CHEST":
    case "CHEST_TEST":
    case "CONTAINER":
      return "CHEST";
    case "GROUND_LOOT":
    case "ITEM_DROP":
    case "DROP":
    case "LOOT_DROP":
      return "ITEM_DROP";
    case "TREE_APPLE":
    case "APPLE_TREE":
    case "TREE":
      return "TREE";
    case "ROCK_NODE_LARGE":
    case "ROCK_NODE_SMALL":
    case "ROCK":
      return "ROCK";
    case "TWIG_PATCH":
    case "TWIG":
      return "TWIG_PATCH";
    case "HERBS_PATCH":
    case "HERBS":
      return "HERBS_PATCH";
    case "RIVER_PATCH":
    case "RIVER_PACH":
      return "RIVER_PATCH";
    case "FIBER_PATCH":
    case "GRASS_PATCH":
      return "GRASS";
    case "NPC":
      return "NPC";
    case "PRIMITIVE_SHELTER":
    case "SHELTER":
      return "PRIMITIVE_SHELTER";
    default:
      return raw || "DEFAULT";
  }
}
