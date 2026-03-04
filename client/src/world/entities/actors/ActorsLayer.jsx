/**
 * ActorsLayer.jsx
 * 
 * Camada que renderiza TODOS os actors do snapshot
 * - Mapeia actors.id -> componente visual
 * - Gerencia spawn/despawn
 * - Passa callbacks de interação
 */
import { memo, useCallback } from "react";
import { getActorComponent } from "./ActorMappings";

/**
 * Componente individual que wraps o actor + seu componente específico
 */
const ActorInstance = memo(function ActorInstance({
  actor,
  ActorComponent,
  onInteract,
}) {
  const handleInteract = useCallback(() => {
    onInteract(actor);
  }, [actor, onInteract]);

  return (
    <ActorComponent
      key={`actor-${actor.id}`}
      actor={actor}
      onInteract={handleInteract}
    />
  );
});

/**
 * ActorsLayer
 * 
 * Props:
 * - snapshot: { actors: [...], ... } (vem do backend)
 * - onActorInteract: (actor) => void (callback quando clica em um actor)
 */
export function ActorsLayer({ snapshot, onActorInteract }) {
  if (!snapshot || !snapshot.actors || snapshot.actors.length === 0) {
    return null;
  }

  const handleActorInteract = useCallback(
    (actor) => {
      if (onActorInteract) {
        onActorInteract(actor);
      }
    },
    [onActorInteract]
  );

  return (
    <group name="actors-layer">
      {snapshot.actors.map((actor) => {
        const ActorComponent = getActorComponent(actor.actorType);

        return (
          <ActorInstance
            key={`actor-${actor.id}`}
            actor={actor}
            ActorComponent={ActorComponent}
            onInteract={handleActorInteract}
          />
        );
      })}
    </group>
  );
}