import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API, withCredentials: true });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("dailyos_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------- Auth ----------
export const authService = {
  register: (data) => client.post("/auth/register", data).then((r) => r.data),
  login: (data) => client.post("/auth/login", data).then((r) => r.data),
  googleSession: (session_id) => client.post("/auth/session", { session_id }).then((r) => r.data),
  me: () => client.get("/auth/me").then((r) => r.data),
  logout: () => client.post("/auth/logout").then((r) => r.data),
};

// ---------- Daily ----------
export const dailyService = {
  get: (date) => client.get(`/daily/${date}`).then((r) => r.data),
  save: (date, payload) => client.put(`/daily/${date}`, payload).then((r) => r.data),
  remove: (date) => client.delete(`/daily/${date}`).then((r) => r.data),
  list: (params) => client.get("/daily", { params }).then((r) => r.data),
};

// ---------- Books ----------
export const bookService = {
  list: () => client.get("/books").then((r) => r.data),
  create: (data) => client.post("/books", data).then((r) => r.data),
  update: (id, data) => client.put(`/books/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/books/${id}`).then((r) => r.data),
};

// ---------- Learning ----------
export const learningService = {
  list: (params) => client.get("/learning", { params }).then((r) => r.data),
  create: (data) => client.post("/learning", data).then((r) => r.data),
  update: (id, data) => client.put(`/learning/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/learning/${id}`).then((r) => r.data),
};

// ---------- Monitoring ----------
export const monitoringService = {
  list: (params) => client.get("/monitoring", { params }).then((r) => r.data),
  create: (data) => client.post("/monitoring", data).then((r) => r.data),
  remove: (id) => client.delete(`/monitoring/${id}`).then((r) => r.data),
};

// ---------- Substack ----------
export const substackService = {
  list: () => client.get("/substack").then((r) => r.data),
  create: (data) => client.post("/substack", data).then((r) => r.data),
  update: (id, data) => client.put(`/substack/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/substack/${id}`).then((r) => r.data),
};

// ---------- Settings / Stats / AI / Demo ----------
export const settingsService = {
  get: () => client.get("/settings").then((r) => r.data),
  update: (data) => client.put("/settings", data).then((r) => r.data),
};
export const statsService = { get: () => client.get("/stats").then((r) => r.data) };
export const aiService = { dailySummary: (date) => client.post("/ai/daily-summary", { date }).then((r) => r.data) };
export const demoService = {
  seed: () => client.post("/demo/seed").then((r) => r.data),
  clear: () => client.post("/demo/clear").then((r) => r.data),
};

export default client;
