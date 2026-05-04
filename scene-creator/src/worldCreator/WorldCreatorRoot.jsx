import { useEffect, useState } from "react";
import { AuthPage } from "@/pages/AuthPage";
import { LoadingOverlay } from "@/components/overlays/LoadingOverlay";
import { bootstrapWorldEditor } from "@editor/services/WorldEditor";
import { createEditorCharacter } from "../Character/editorCharacter";
import { useWorldCreatorState } from "@editor/worldCreator/useWorldCreatorState";
import { WorldCreatorView } from "@editor/worldCreator/WorldCreatorView";

const TOKEN_KEY = "token";

function buildEditorStartPos(data) {
  const sizeX = Number(data?.snapshot?.localTemplate?.geometry?.size_x ?? 100);
  const sizeZ = Number(data?.snapshot?.localTemplate?.geometry?.size_z ?? 100);
  return {
    x: Number.isFinite(sizeX) ? sizeX / 2 : 0,
    y: 0,
    z: Number.isFinite(sizeZ) ? sizeZ / 2 : 0,
  };
}
export function WorldCreatorRoot() {
  const [hasToken, setHasToken] = useState(false);
  const state = useWorldCreatorState();

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    setHasToken(!!token);
  }, []);

  useEffect(() => {
    if (!hasToken) {
      state.setLoading(false);
      state.setBootstrapError(null);
      state.setSnapshot(null);
      state.setCatalogs({ actorDefs: [], objectDefs: [] });
      state.setEditorMeta(null);
      return;
    }

    let alive = true;
    const token = localStorage.getItem(TOKEN_KEY);

    const load = async () => {
      state.setLoading(true);
      state.setBootstrapError(null);

      const data = await bootstrapWorldEditor(token);
      if (!alive) return;

      if (!data || data.error) {
        if (data?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setHasToken(false);
          state.setLoading(false);
          return;
        }

        state.setBootstrapError(data?.message || "Falha ao carregar o scene creator");
        state.setLoading(false);
        return;
      }

      const startPos = buildEditorStartPos(data);
      const editorCharacter = createEditorCharacter(startPos, 0);
      state.editorCharacterRef.current = editorCharacter;
      state.editorAnchorRef.current = editorCharacter.pos;
      state.editorCameraFocusRef.current = editorCharacter.pos;
      const nextSnapshot = {
        ...(data.snapshot ?? null),
        runtime: {
          ...((data.snapshot ?? null)?.runtime ?? null),
          pos: editorCharacter.pos,
        },
        sceneObjects: [
          editorCharacter,
          ...(((data.snapshot ?? null)?.sceneObjects ?? []).filter(
            (entry) => String(entry?.id ?? "") !== String(editorCharacter.id)
          )),
        ],
        localTemplateVersion: data.localTemplateVersion ?? null,
        localTemplate: data.localTemplate ?? null,
        proceduralMap: data.proceduralMap ?? null,
        worldClock: data.worldClock ?? null,
      };
      state.setSnapshot(nextSnapshot);
      state.setEditorMeta({
        ...data,
        editor: {
          ...((data.editor ?? null) ?? {}),
          operator: {
            ...((data.editor ?? null)?.operator ?? {}),
            pos: editorCharacter.pos,
          },
        },
        snapshot: nextSnapshot,
      });
      state.setCatalogs(data.catalogs ?? { actorDefs: [], objectDefs: [] });
      state.setLoading(false);
    };

    load();

    return () => {
      alive = false;
    };
  }, [hasToken, state]);

  const handleLogin = (token) => {
    localStorage.setItem(TOKEN_KEY, token);
    setHasToken(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setHasToken(false);
  };

  if (!hasToken) {
    return <AuthPage onLoggedIn={handleLogin} />;
  }

  if (state.loading) {
    return <LoadingOverlay message="Carregando scene creator..." />;
  }

  if (state.bootstrapError) {
    return <LoadingOverlay message={state.bootstrapError} />;
  }

  if (!state.snapshot) {
    return <LoadingOverlay message="Falha ao montar editor de cena" />;
  }

  return <WorldCreatorView state={state} onLogout={handleLogout} />;
}
