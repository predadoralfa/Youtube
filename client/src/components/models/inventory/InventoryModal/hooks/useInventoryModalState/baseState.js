import { useRef, useState } from "react";

export function useInventoryModalBaseState() {
  const [dragItem, setDragItem] = useState(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [contextMenu, setContextMenu] = useState(null);
  const [splitDraft, setSplitDraft] = useState(null);
  const [localNotice, setLocalNotice] = useState(null);
  const [dismissedNoticeText, setDismissedNoticeText] = useState(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState("equipment");
  const [macroFoodItemInstanceId, setMacroFoodItemInstanceId] = useState(null);
  const [macroHungerThreshold, setMacroHungerThreshold] = useState(60);

  return {
    dragItem,
    setDragItem,
    cursorPos,
    setCursorPos,
    contextMenu,
    setContextMenu,
    splitDraft,
    setSplitDraft,
    localNotice,
    setLocalNotice,
    dismissedNoticeText,
    setDismissedNoticeText,
    activeSidebarTab,
    setActiveSidebarTab,
    macroFoodItemInstanceId,
    setMacroFoodItemInstanceId,
    macroHungerThreshold,
    setMacroHungerThreshold,
    dropHandledRef: useRef(false),
    splitInputRef: useRef(null),
  };
}
