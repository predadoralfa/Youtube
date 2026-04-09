export function PlaceholderTab({ activeSidebarTab }) {
  return (
    <div className="inv-tab-placeholder">
      <div className="inv-tab-placeholder-title">{activeSidebarTab === "craft" ? "Craft" : "Macro"}</div>
      <div className="inv-tab-placeholder-text">
        {activeSidebarTab === "craft"
          ? "No recipes unlocked yet. Press R to open Research, complete your first studies, and come back here to start crafting."
          : "No macro setup yet. Configure your automation after unlocking the right study paths."}
      </div>
    </div>
  );
}
