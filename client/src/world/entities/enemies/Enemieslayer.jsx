import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const rabbitModelUrl = new URL("../../../assets/Rabbit.glb", import.meta.url).href;
const rabbitLoader = new GLTFLoader();
let rabbitModelPromise = null;
let rabbitModelTemplate = null;

function normalizeEnemyVisualToken(entity) {
  const visualKind = String(entity?.visualKind ?? "").trim().toUpperCase();
  const enemyDefCode = String(entity?.enemyDefCode ?? "").trim().toUpperCase();
  const enemyDefName = String(entity?.enemyDefName ?? "").trim().toUpperCase();
  const displayName = String(entity?.displayName ?? "").trim().toUpperCase();
  const token = `${visualKind} ${enemyDefCode} ${enemyDefName} ${displayName}`;

  if (token.includes("RABBIT") || token.includes("COELHO")) {
    return "RABBIT";
  }

  return "DEFAULT";
}

async function loadRabbitModelTemplate() {
  if (rabbitModelTemplate) return rabbitModelTemplate;

  if (!rabbitModelPromise) {
    rabbitModelPromise = rabbitLoader.loadAsync(rabbitModelUrl)
      .then((gltf) => {
        rabbitModelTemplate = gltf.scene;
        return rabbitModelTemplate;
      })
      .catch((error) => {
        rabbitModelPromise = null;
        throw error;
      });
  }

  return rabbitModelPromise;
}

function cloneAndAlignModel(template, scaleScalar) {
  const model = template.clone(true);
  model.scale.setScalar(scaleScalar);
  model.position.set(0, 0, 0);
  model.rotation.set(0, 0, 0);

  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const box = new THREE.Box3().setFromObject(model);
  if (!box.isEmpty()) {
    const center = box.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box.min.y;
  }

  return model;
}

function resolveEnemyVisualScale(entity) {
  const explicit = Number(entity?.visualScale ?? entity?.visual_scale ?? 1);
  return Number.isFinite(explicit) && explicit > 0 ? explicit : 1;
}

export function EnemiesLayer({ worldStoreRef }) {
  const store = worldStoreRef?.current;
  const subscribe = store?.subscribe ?? (() => () => {});
  const getVersionSnapshot = () => store?.version ?? 0;
  const version = useSyncExternalStore(subscribe, getVersionSnapshot, getVersionSnapshot);
  const entities = useMemo(() => store?.getSnapshot?.() ?? [], [store, version]);
  const selfId = store?.selfId ?? null;

  const enemies = useMemo(() => {
    return entities.filter((entity) => {
      if (selfId && String(selfId) === String(entity.entityId)) return false;
      return true;
    });
  }, [entities, selfId]);

  return (
    <group name="enemies-layer">
      {enemies.map((entity) => (
        <EnemyEntity key={String(entity.entityId)} entity={entity} />
      ))}
    </group>
  );
}

function EnemyEntity({ entity }) {
  const x = Number(entity?.pos?.x ?? 0);
  const z = Number(entity?.pos?.z ?? 0);
  const yaw = Number(entity?.yaw ?? 0);
  const visualToken = normalizeEnemyVisualToken(entity);
  const visualScale = resolveEnemyVisualScale(entity);
  const [model, setModel] = useState(null);

  useEffect(() => {
    let cancelled = false;

    if (visualToken !== "RABBIT") {
      setModel(null);
      return () => {
        cancelled = true;
      };
    }

    loadRabbitModelTemplate()
      .then((template) => {
        if (cancelled) return;
        const rabbit = cloneAndAlignModel(template, visualScale);
        rabbit.userData.visualScale = visualScale;
        setModel(rabbit);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[ENEMIES_LAYER] Failed to load rabbit model:", error);
        setModel(null);
      });

    return () => {
      cancelled = true;
    };
  }, [visualToken, visualScale]);

  return (
    <group
      position={[x, 0, z]}
      rotation={[0, yaw, 0]}
      name={`enemy-${entity.entityId}`}
    >
      {model ? (
        <primitive object={model} />
      ) : (
        <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color={"#ff6b35"} metalness={0.3} roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}
