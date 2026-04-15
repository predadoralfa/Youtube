import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds, Center, useGLTF } from "@react-three/drei";

const rockModelUrl = new URL("../../../assets/Rock.glb", import.meta.url).href;
const appleModelUrl = new URL("../../../assets/Apple.glb", import.meta.url).href;
const grassModelUrl = new URL("../../../assets/Grass.glb", import.meta.url).href;

function normalizeText(value) {
  return String(value ?? "").trim().toUpperCase();
}

function resolveInventoryIconSpec(itemDef) {
  const code = normalizeText(itemDef?.code);
  const name = normalizeText(itemDef?.name);
  const category = normalizeText(itemDef?.category);

  if (code.includes("APPLE") || name.includes("APPLE")) {
    return {
      url: appleModelUrl,
      scale: 1.25,
      cameraPosition: [0, 0, 3.2],
    };
  }

  if (code.includes("FIBER") || code.includes("GRASS") || name.includes("FIBER") || name.includes("GRASS") || name.includes("GRAMA")) {
    return {
      url: grassModelUrl,
      scale: 1.15,
      cameraPosition: [0, 0, 3.15],
    };
  }

  if (
    code.includes("ROCK") ||
    code.includes("STONE") ||
    name.includes("ROCK") ||
    name.includes("STONE") ||
    name.includes("PEDRA")
  ) {
    return {
      url: rockModelUrl,
      scale: 1.4,
      cameraPosition: [0, 0, 3.1],
    };
  }

  if (category === "FOOD") {
    return {
      url: appleModelUrl,
      scale: 1.25,
      cameraPosition: [0, 0, 3.2],
    };
  }

  return null;
}

function FallbackGlyph({ label }) {
  const glyph = String(label ?? "IT")
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "IT";

  return <span className="inv-item-icon-fallback">{glyph}</span>;
}

function InventoryModelPreview({ spec }) {
  const gltf = useGLTF(spec.url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf]);

  return (
    <>
      <ambientLight intensity={2.2} />
      <directionalLight position={[3, 4, 5]} intensity={1.8} />
      <directionalLight position={[-2, 2, 3]} intensity={1.1} />
      <Bounds fit clip observe margin={1.25}>
        <Center>
          <primitive object={scene} scale={spec.scale ?? 1} rotation={spec.rotation ?? [0, 0.45, 0]} />
        </Center>
      </Bounds>
    </>
  );
}

export function InventoryItemIcon({ itemDef, label, className = "" }) {
  const spec = resolveInventoryIconSpec(itemDef);

  if (!spec?.url) {
    return (
      <div className={["inv-item-icon-shell", className].filter(Boolean).join(" ")}>
        <FallbackGlyph label={label} />
      </div>
    );
  }

  return (
    <div className={["inv-item-icon-shell", className].filter(Boolean).join(" ")}>
      <Canvas
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true }}
        camera={{ position: spec.cameraPosition ?? [0, 0, 3], fov: 26 }}
      >
        <Suspense fallback={null}>
          <InventoryModelPreview spec={spec} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload(rockModelUrl);
useGLTF.preload(appleModelUrl);
useGLTF.preload(grassModelUrl);
