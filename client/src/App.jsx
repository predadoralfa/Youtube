import React, { useState, useRef, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars, Grid, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

function Player({ position, setPosition, rotation, setRotation }) {
  const meshRef = useRef();
  const keys = useRef({});

  // Captura as teclas pressionadas para movimento suave
  useEffect(() => {
    const down = (e) => (keys.current[e.key.toLowerCase()] = true);
    const up = (e) => (keys.current[e.key.toLowerCase()] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((state, delta) => {
    const speed = 5 * delta; // Velocidade baseada no tempo (mais suave)
    const turnSpeed = 3 * delta;

    // Rotação (A e D giram o personagem)
    if (keys.current["a"]) setRotation((r) => r + turnSpeed);
    if (keys.current["d"]) setRotation((r) => r - turnSpeed);

    // Movimentação (W e S movem para frente/trás baseado na rotação)
    if (keys.current["w"]) {
      setPosition((p) => [
        p[0] - Math.sin(rotation) * speed,
        p[1],
        p[2] - Math.cos(rotation) * speed,
      ]);
    }
    if (keys.current["s"]) {
      setPosition((p) => [
        p[0] + Math.sin(rotation) * speed,
        p[1],
        p[2] + Math.cos(rotation) * speed,
      ]);
    }

    // --- LÓGICA DA CÂMERA PERSEGUIDORA ---
    // Calculamos a posição ideal da câmera (atrás e acima do herói)
    const offset = new THREE.Vector3(
      Math.sin(rotation) * 5, 
      3,                      
      Math.cos(rotation) * 5  
    );
    
    const idealLookAt = new THREE.Vector3(...position);
    state.camera.position.lerp(new THREE.Vector3(
        position[0] + offset.x,
        position[1] + offset.y,
        position[2] + offset.z
    ), 0.1); // O 0.1 dá um efeito de "suavidade" na perseguição
    
    state.camera.lookAt(idealLookAt);
  });

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Corpo do Herói */}
      <mesh ref={meshRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="blue" />
      </mesh>
      {/* "Nariz" do cubo para sabermos onde é a frente */}
      <mesh position={[0, 0, -0.6]}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="red" />
      </mesh>
    </group>
  );
}

export default function App() {
  const [playerPos, setPlayerPos] = useState([0, 0.5, 0]);
  const [playerRot, setPlayerRot] = useState(0);
  const [itemPos, setItemPos] = useState([5, 0.5, 5]);
  const [pontos, setPontos] = useState(0);

  // Colisão
  useEffect(() => {
    const dist = Math.sqrt(
      Math.pow(playerPos[0] - itemPos[0], 2) +
      Math.pow(playerPos[2] - itemPos[2], 2)
    );
    if (dist < 1.2) {
      setPontos((p) => p + 1);
      setItemPos([(Math.random() - 0.5) * 20, 0.5, (Math.random() - 0.5) * 20]);
    }
  }, [playerPos, itemPos]);

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#111" }}>
      <div style={{ position: "absolute", top: 20, left: 20, color: "white", zIndex: 10, pointerEvents: "none" }}>
        <h1>Score: {pontos}</h1>
        <p>W: Frente | S: Trás | A/D: Girar Câmera e Herói</p>
      </div>
      
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 5, 10]} />
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} castShadow />
        <Stars radius={100} factor={4} />
        <Grid infiniteGrid sectionColor="#444" cellColor="#222" />

        <Player 
          position={playerPos} 
          setPosition={setPlayerPos} 
          rotation={playerRot} 
          setRotation={setPlayerRot} 
        />

        <mesh position={itemPos}>
          <sphereGeometry args={[0.5, 32, 32]} />
          <meshStandardMaterial color="gold" emissive="yellow" emissiveIntensity={0.5} />
        </mesh>
      </Canvas>
    </div>
  );
}