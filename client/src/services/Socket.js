// src/services/Socket.js
import { io } from "socket.io-client";
import {API_BASE_URL} from "./Api"

let socket = null;

export function connectSocket(token) {
  if (socket) return socket;

  socket = io(import.meta.env.VITE_SERVER_URL ?? API_BASE_URL, {
    transports: ["websocket"],
    auth: { token },
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
