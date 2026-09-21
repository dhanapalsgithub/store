import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/index.css";
import api from "@/lib/api";
import Login from "@/pages/Login";
import Admin from "@/pages/Admin";
import Purchases from "./components/admin/Purchases";
import PartyPayments from "./components/admin/PartyPayments"; // Imported PartyPayments page component
import Store from "@/pages/Store";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const token = localStorage.getItem("sps_token");
    if (!token) {
      setUser(null);
      return;
    }
    
    // Check user profile via API adapter (reads from localStorage securely)
    api.get("/auth/me")
      .then((r) => {
        const userData = r.data?.user || r.data;
        setUser(userData?.id || userData?.email || userData?.role ? userData : null);
      })
      .catch(() => {
        localStorage.removeItem("sps_token");
        setUser(null);
      });
  }, []);

  const login = useCallback((data) => {
    localStorage.setItem("sps_token", data.token);
    if (data.user) {
      localStorage.setItem("sps_user", JSON.stringify(data.user));
    }
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("sps_token");
    localStorage.removeItem("sps_user");
    setUser(null);
  }, []);

  return <AuthCtx.Provider value={{ user, setUser, login, logout }}>{children}</AuthCtx.Provider>;
}

function Home() {
  const { user } = useAuth();
  if (user === undefined)
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="app-loading">
        <div className="w-10 h-10 border-4 border-emerald-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === "Owner" ? "/admin" : "/store"} replace />;
}

function Guard({ role, children }) {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === "Owner" ? "/admin" : "/store"} replace />;
  return children;
}

function LoginRoute() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) navigate(user.role === "Owner" ? "/admin" : "/store", { replace: true });
  }, [user, navigate]);
  return <Login />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-center" richColors />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginRoute />} />
          <Route path="/admin" element={<Guard role="Owner"><Admin /></Guard>} />
          <Route path="/admin/purchases" element={<Guard role="Owner"><Purchases /></Guard>} />
          <Route path="/admin/partypayments" element={<Guard role="Owner"><PartyPayments /></Guard>} /> {/* Added PartyPayments Route */}
          <Route path="/store" element={<Guard role="Customer"><Store /></Guard>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;