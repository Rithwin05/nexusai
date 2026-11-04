import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "@clerk/nextjs";

export const API = process.env.NEXT_PUBLIC_BACKEND_URL
  ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api`
  : (process.env.REACT_APP_BACKEND_URL ? `${process.env.REACT_APP_BACKEND_URL}/api` : "/api");

export const errMsg = (e) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d[0]?.msg || "Invalid input";
  return e?.message || "Something went wrong";
};

export function useApi() {
  const { getToken } = useAuth();
  const tokenRef = useRef(getToken);
  tokenRef.current = getToken;
  return useMemo(() => {
    const client = axios.create({ baseURL: API });
    client.interceptors.request.use(async (cfg) => {
      const t = await tokenRef.current?.();
      if (t) cfg.headers.Authorization = `Bearer ${t}`;
      return cfg;
    });
    client.stream = async (path, body, onEvent, signal) => {
      const t = await tokenRef.current?.();
      const res = await fetch(`${API}${path}`, {
        method: "POST", signal, body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
      });
      if (!res.ok) {
        let detail = `Request failed (${res.status})`;
        try { const j = await res.json(); detail = typeof j.detail === "string" ? j.detail : j.detail?.[0]?.msg || detail; } catch {}
        throw new Error(detail);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (line.startsWith("data: ")) onEvent(JSON.parse(line.slice(6)));
        }
      }
    };
    client.blob = async (path) => (await client.get(path, { responseType: "blob" })).data;
    return client;
  }, []);
}

export function useFetch(path, { interval } = {}) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(path));

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const r = await api.get(path);
      setData(r.data);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [api, path]);

  useEffect(() => { setLoading(Boolean(path)); load(); }, [load, path]);
  useEffect(() => {
    if (!interval) return undefined;
    const id = setInterval(load, interval);
    return () => clearInterval(id);
  }, [interval, load]);

  return { data, error, loading, reload: load, setData };
}
