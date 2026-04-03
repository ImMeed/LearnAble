import axios from "axios";

import { getSession } from "../state/auth";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

if (!import.meta.env.VITE_API_BASE_URL) {
  // Keep local development usable when env setup is incomplete.
  console.warn("VITE_API_BASE_URL is not set. Falling back to http://127.0.0.1:8000");
}

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
});

apiClient.interceptors.request.use((config) => {
  const session = getSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  return config;
});
