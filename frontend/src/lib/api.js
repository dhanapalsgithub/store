import axios from "axios";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sps_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errMsg = (e) => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg || "").join(" ");
  return e?.message || "Something went wrong";
};

export const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const CATEGORIES = [
  { id: "Attai", tamil: "அட்டை மாவு வகைகள்", english: "Attai (Flours)" },
  { id: "Saram", tamil: "சரம் பொருட்கள்", english: "Saram (Provisions & Grains)" },
  { id: "Loose Pack", tamil: "லூஸ் பேக் பொருட்கள்", english: "Loose Pack Items" },
];

export const catBadge = (cat) =>
  cat === "Attai"
    ? "bg-amber-100 text-amber-800 border-amber-200"
    : cat === "Saram"
    ? "bg-emerald-100 text-emerald-800 border-emerald-200"
    : "bg-blue-100 text-blue-800 border-blue-200";

export const statusBadge = (s) =>
  s === "Delivered"
    ? "bg-emerald-100 text-emerald-700"
    : s === "Shipped"
    ? "bg-blue-100 text-blue-700"
    : "bg-amber-100 text-amber-700";

export default api;
