export function apiUrl(path) {
  const base = import.meta.env.VITE_API_BASE_URL;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
