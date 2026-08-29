import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { api, UserState } from "./services/api";
import { Navbar } from "./components/Navbar";
import { Dashboard } from "./pages/Dashboard";
import { LivePlayer } from "./pages/LivePlayer";
import { MultiView } from "./pages/MultiView";
import { Recordings } from "./pages/Recordings";
import { RecordingPlayer } from "./pages/RecordingPlayer";
import { Login } from "./pages/Login";

export const App: React.FC = () => {
  const [userState, setUserState] = useState<UserState>({
    authenticated: false,
    guest: true,
    user: null,
  });
  const [loading, setLoading] = useState(true);

  // Theme Management (Light / Dark)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("theme");
    return saved !== null ? saved === "dark" : true; // Default dark
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark((prev) => !prev);
  };

  const checkAuth = async () => {
    try {
      const res = await api.get("/auth/me");
      setUserState(res.data);
    } catch {
      setUserState({ authenticated: false, guest: true, user: null });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLoginSuccess = (user: any) => {
    setUserState({ authenticated: true, guest: false, user });
  };

  const handleLogout = () => {
    setUserState({ authenticated: false, guest: true, user: null });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-500">
        Initializing Dhanush UAV System...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
        <Navbar
          userState={userState}
          onLogout={handleLogout}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Dashboard userState={userState} />} />
            <Route path="/multiview" element={<MultiView />} />
            <Route path="/watch/:key" element={<LivePlayer />} />
            <Route path="/recordings" element={<Recordings userState={userState} />} />
            <Route path="/recordings/:id" element={<RecordingPlayer userState={userState} />} />
            <Route
              path="/login"
              element={
                userState.authenticated ? (
                  <Navigate to="/" replace />
                ) : (
                  <Login onLoginSuccess={handleLoginSuccess} />
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="py-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© 2026 Dhanush UAV Systems. Ultra-Low Latency Live Operations.</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">System v1.2.0 • MediaMTX Engine</span>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};
