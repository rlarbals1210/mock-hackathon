export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
