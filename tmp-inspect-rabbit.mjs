import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { LoadingManager } from "three";
import { pathToFileURL } from "node:url";

const fileUrl = pathToFileURL("D:/JS-Projects/Youtube/client/src/assets/Rabbit.glb").href;
const manager = new LoadingManager();
const loader = new GLTFLoader(manager);
const gltf = await loader.loadAsync(fileUrl);
const clips = (gltf.animations ?? []).map((clip) => ({ name: clip.name, duration: clip.duration, tracks: clip.tracks?.length ?? 0 }));
console.log(JSON.stringify({ clipCount: clips.length, clips }, null, 2));
