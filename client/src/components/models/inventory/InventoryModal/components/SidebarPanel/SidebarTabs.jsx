import { SIDEBAR_TABS } from "../../constants";

export function SidebarTabs({ activeSidebarTab, setActiveSidebarTab }) {
  return (
    <div className="inv-tab-bar" role="tablist" aria-label="Inventory side panels">
      {SIDEBAR_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={activeSidebarTab === tab.id}
          className={["inv-tab-button", activeSidebarTab === tab.id ? "is-active" : ""].filter(Boolean).join(" ")}
          onClick={() => setActiveSidebarTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
