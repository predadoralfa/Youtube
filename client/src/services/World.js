import { API_BASE_URL } from "./Api";

/**
 * Busca o snapshot inicial do mundo.
 * - Token vai no header Authorization
 * - Backend resolve user -> runtime -> instance -> local template
 */
export async function bootstrapWorld(token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(`${API_BASE_URL}/world/bootstrap`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    // tenta ler JSON, mas não explode se vier HTML/texto
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }

    if (!res.ok) {
      return {
        error: true,
        status: res.status,
        message: data?.message || "Falha no bootstrap",
        raw: data,
      };
    }

    return data;
  } catch (err) {
    return {
      error: true,
      status: 0,
      message: err?.name === "AbortError" ? "Timeout no bootstrap" : String(err),
    };
  } finally {
    clearTimeout(timeout);
  }
}
