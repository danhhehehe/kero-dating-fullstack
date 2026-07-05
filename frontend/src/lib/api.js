import axios from "axios";

const RAW_API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_ORIGIN = RAW_API_URL.replace(/\/+$/, "");
const API_BASE_URL = API_ORIGIN.endsWith("/api") ? API_ORIGIN : `${API_ORIGIN}/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20_000,
  withCredentials: true,
  headers: { "Content-Type": "application/json" }
});

api.interceptors.response.use(r => r, e => {
  const error = new Error(e.response?.data?.message || "Có lỗi xảy ra.");
  error.code = e.response?.data?.code;
  return Promise.reject(error);
});

export default api;
