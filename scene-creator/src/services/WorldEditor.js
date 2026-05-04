import { API_BASE_URL } from "@/services/Api";

async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function request(path, token, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    console.warn("[SCENE_CREATOR_BOOTSTRAP_HTTP_ERROR]", {
      path,
      status: res.status,
      message: data?.message || "World editor request failed",
      rawKeys: data && typeof data === "object" ? Object.keys(data) : null,
    });
    return {
      error: true,
      status: res.status,
      message: data?.message || "World editor request failed",
      raw: data,
    };
  }

  return data;
}

export function bootstrapWorldEditor(token) {
  return request("/world/editor/bootstrap", token, { method: "GET" });
}

export function fetchActorDefs(token) {
  return request("/world/editor/actor-defs", token, { method: "GET" });
}

export function fetchObjectDefs(token) {
  return request("/world/editor/object-defs", token, { method: "GET" });
}

export function spawnActor(token, payload) {
  return request("/world/editor/actors", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function spawnSceneObject(token, payload) {
  return request("/world/editor/objects", token, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateActor(token, actorId, payload) {
  return request(`/world/editor/actors/${actorId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function updateSceneObject(token, sceneObjectId, payload) {
  return request(`/world/editor/objects/${sceneObjectId}`, token, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function disableActor(token, actorId) {
  return request(`/world/editor/actors/${actorId}`, token, {
    method: "DELETE",
  });
}

export function disableSceneObject(token, sceneObjectId) {
  return request(`/world/editor/objects/${sceneObjectId}`, token, {
    method: "DELETE",
  });
}
