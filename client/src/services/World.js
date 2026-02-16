import { API_BASE_URL } from "./Api";

/**
 * Busca o snapshot inicial do mundo.
 * - Token vai no header Authorization
 * - Backend resolve user -> runtime -> instance -> local template
 */
export async function bootstrapWorld(token) {
  const res = await fetch(`${API_BASE_URL}/world/bootstrap`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // tenta ler json mesmo em erro (para pegar message)
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      error: data?.message || `Erro no bootstrap (${res.status})`,
      status: res.status,
    };
  }

  return data;
}
