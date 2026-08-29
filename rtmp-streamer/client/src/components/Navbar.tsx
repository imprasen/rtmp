import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Radio, Video, LogOut, Shield, User, LayoutGrid, Sun, Moon, Users, Menu, X } from "lucide-react";
import { UserState, api } from "../services/api";

interface NavbarProps {
  userState: UserState;
  onLogout: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ userState, onLogout, isDark, onToggleTheme }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogoutClick = async () => {
    try {
      await api.post("/auth/logout");
      onLogout();
      setMobileMenuOpen(false);
      navigate("/login");
    } catch {
      onLogout();
      setMobileMenuOpen(false);
      navigate("/login");
    }
  };

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6 sm:space-x-8">
          <Link to="/" onClick={closeMenu} className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-900/30 group-hover:scale-105 transition-transform">
              <Radio className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                Dhanush <span className="text-emerald-600 dark:text-emerald-400">UAV</span>
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 block -mt-1 font-medium">RTMP Live Streamer</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          {userState.authenticated && (
            <nav className="hidden md:flex items-center space-x-1">
              <Link
                to="/"
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === "/"
                    ? "bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Radio className="w-4 h-4" /> Channels
                </span>
              </Link>

              <Link
                to="/multiview"
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === "/multiview"
                    ? "bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4" /> Multi-View Grid
                </span>
              </Link>

              <Link
                to="/recordings"
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith("/recordings")
                    ? "bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
              >
                <span className="flex items-center gap-2">
                  <Video className="w-4 h-4" /> VOD Recordings
                </span>
              </Link>

              {userState.user?.role === "admin" && (
                <Link
                  to="/users"
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === "/users"
                      ? "bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" /> Users
                  </span>
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={onToggleTheme}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          </button>

          {userState.authenticated ? (
            <div className="flex items-center space-x-2">
              <div className="hidden sm:flex items-center space-x-2 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{userState.user?.username}</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-mono font-semibold">
                  {userState.user?.role}
                </span>
              </div>
              <button
                onClick={handleLogoutClick}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Logout"
                aria-label="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>

              {/* Mobile Hamburger Menu Toggle Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Open Navigation Menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg shadow transition-colors"
            >
              <User className="w-4 h-4" /> Admin Login
            </Link>
          )}
        </div>
      </div>

      {/* P1-14: Mobile Navigation Drawer (Collapsible) */}
      {mobileMenuOpen && userState.authenticated && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 pt-3 pb-5 space-y-1.5 animate-fade-in shadow-xl">
          <div className="pb-3 mb-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <User className="w-3.5 h-3.5" /> Logged in as: <strong className="text-slate-800 dark:text-slate-200">{userState.user?.username}</strong>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              {userState.user?.role}
            </span>
          </div>

          <Link
            to="/"
            onClick={closeMenu}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              location.pathname === "/"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Radio className="w-4 h-4" /> Drone Channels
          </Link>

          <Link
            to="/multiview"
            onClick={closeMenu}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              location.pathname === "/multiview"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <LayoutGrid className="w-4 h-4" /> Multi-View Wallboard
          </Link>

          <Link
            to="/recordings"
            onClick={closeMenu}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              location.pathname.startsWith("/recordings")
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Video className="w-4 h-4" /> VOD Recordings Archive
          </Link>

          {userState.user?.role === "admin" && (
            <Link
              to="/users"
              onClick={closeMenu}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                location.pathname === "/users"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <Users className="w-4 h-4" /> User Management Portal
            </Link>
          )}
        </div>
      )}
    </header>
  );
};
