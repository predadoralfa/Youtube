function normalizeBaseUrl(url, fallback) {
  const value = String(url ?? "").trim();
  if (!value) return fallback;
  return value.replace(/\/+$/, "");
}

export const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  "http://localhost:5100"
);
