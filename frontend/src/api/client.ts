import axios from "axios";

import { getSession } from "../state/auth";

// Empty string = use Vite proxy (relative URLs). Explicit URL = direct connection.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

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
