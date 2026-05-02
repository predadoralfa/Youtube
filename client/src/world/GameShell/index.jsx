import { useGameShellActions } from "./actions";
import { useGameShellSocket } from "./socketLifecycle/useGameShellSocket";
import { useGameShellState } from "./useGameShellState";
import { GameShellView } from "./view";

export function GameShell() {
  const state = useGameShellState();
  const actions = useGameShellActions(state);

  useGameShellSocket(state, actions.requestInventoryFull, actions.requestResearchFull);

  return <GameShellView state={state} actions={actions} />;
}
