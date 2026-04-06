import { TreeWindowModal } from "@/components/models/common/TreeWindowModal";

const BUILD_NODES = [
  {
    id: "build-core",
    tone: "build",
    iconLabel: "B",
    badge: "Build",
    title: "Primitive Shelter",
    description: "Mark a ground spot for the first sleeping place and survival base.",
    metaLeft: "Branch: Shelter",
    metaRight: "Tier 0",
    actionLabel: "Coming Soon",
  },
  {
    id: "build-grid",
    tone: "build",
    iconLabel: "G",
    badge: "Build",
    title: "Placement Grid",
    description: "Reserve room for future floors, walls and small structures.",
    metaLeft: "Branch: Grid",
    metaRight: "Tier 1",
    actionLabel: "Coming Soon",
  },
];

export function BuildModal({ open, onClose }) {
  return (
    <TreeWindowModal
      open={open}
      kicker="Build"
      title="Builder Tree"
      copy="A simple planning screen for future placement and survival construction."
      footerLeft="Shortcut: B"
      nodes={BUILD_NODES}
      onClose={onClose}
    />
  );
}
