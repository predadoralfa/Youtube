const STORAGE_KEY = "scene_creator_ui_settings_v1";

const DEFAULT_SETTINGS = {
  mainPanelOpen: true,
  mainPanelPosition: { top: 16, left: 16 },
  spawnPanelOpen: false,
  terrainPanelOpen: false,
  gmPanelOpen: false,
  gmMoveStep: "10",
  gmCharacterVisible: true,
  gmPos: null,
};

export function getDefaultSceneCreatorSettings() {
  return {
    ...DEFAULT_SETTINGS,
    mainPanelPosition: { ...DEFAULT_SETTINGS.mainPanelPosition },
  };
}

export function loadSceneCreatorSettings() {
  if (typeof window === "undefined") return getDefaultSceneCreatorSettings();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSceneCreatorSettings();
    const parsed = JSON.parse(raw);
    return {
      ...getDefaultSceneCreatorSettings(),
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      mainPanelPosition: {
        ...DEFAULT_SETTINGS.mainPanelPosition,
        ...((parsed && parsed.mainPanelPosition) || {}),
      },
    };
  } catch {
    return getDefaultSceneCreatorSettings();
  }
}

export function saveSceneCreatorSettings(patch) {
  if (typeof window === "undefined") return;

  const next = {
    ...loadSceneCreatorSettings(),
    ...(patch && typeof patch === "object" ? patch : {}),
    mainPanelPosition: {
      ...loadSceneCreatorSettings().mainPanelPosition,
      ...((patch && patch.mainPanelPosition) || {}),
    },
  };

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
