export function PlaceholderTab({ activeSidebarTab, message }) {
  const title =
    activeSidebarTab === "craft"
      ? "Craft"
      : activeSidebarTab === "equipment"
        ? "Equipment"
        : "Macro";

  return (
    <div className="inv-tab-placeholder">
      <div className="inv-tab-placeholder-title">{title}</div>
      <div className="inv-tab-placeholder-text">
        {message ??
          (activeSidebarTab === "craft"
            ? "No recipes unlocked yet. Press R to open Research, complete your first studies, and come back here to start crafting."
            : activeSidebarTab === "equipment"
              ? "No equipment setup yet. Press R to open Research, complete your first studies, and come back here to start using equipment."
            : "No macro setup yet. Press R to open Research, complete your first studies, and come back here to start configuring automation.")}
      </div>
    </div>
  );
}
