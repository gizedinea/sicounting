import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";
import "./Components.css";

const SIDEBAR_EVENT = "sicounting-sidebar-toggle";

function Header() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const getCurrentUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !data?.user) {
        setUser(null);
        return;
      }

      setUser(data.user);
    };

    getCurrentUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const userName =
    user?.user_metadata?.nama ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Pengguna";

  const userInitial = userName.trim().charAt(0).toUpperCase() || "U";

  const toggleMobileSidebar = () => {
    const nextOpen = !mobileSidebarOpen;

    setMobileSidebarOpen(nextOpen);

    window.dispatchEvent(
      new CustomEvent(SIDEBAR_EVENT, {
        detail: { open: nextOpen },
      })
    );
  };

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        alert("Logout gagal: " + error.message);
        return;
      }

      setMenuOpen(false);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error(error);
      alert("Terjadi kesalahan saat logout.");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <header className={`header header-${theme}`}>
      <div className="header-left">
        {/* Toggle sidebar khusus mobile */}
        <button
          type="button"
          className="mobile-sidebar-toggle"
          onClick={toggleMobileSidebar}
          aria-label={
            mobileSidebarOpen ? "Tutup sidebar" : "Buka sidebar"
          }
          aria-expanded={mobileSidebarOpen}
          title={mobileSidebarOpen ? "Tutup menu" : "Buka menu"}
        >
          {mobileSidebarOpen ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m18 6-12 12" />
              <path d="m6 6 12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          )}
        </button>

        <div className="header-title">
          <h1>Dashboard</h1>
          <p>Ringkasan kondisi keuangan bisnis Anda.</p>
        </div>
      </div>

      <div className="header-right">
        {/* Theme toggle */}
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label="Ganti tema"
          title="Ganti tema"
        >
          {theme === "light" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2" />
              <path d="M12 20v2" />
              <path d="m4.93 4.93 1.41 1.41" />
              <path d="m17.66 17.66 1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M20 12h2" />
              <path d="m6.34 17.66-1.41 1.41" />
              <path d="m19.07 4.93-1.41 1.41" />
            </svg>
          )}
        </button>

        {/* Notification */}
        <button
          type="button"
          className="header-icon-button"
          aria-label="Notifikasi"
          title="Notifikasi"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
            <path d="M10 21h4" />
          </svg>

          <span className="notification-dot"></span>
        </button>

        {/* User profile */}
        <div className="header-user-container">
          <button
            type="button"
            className="header-user"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-label="Menu pengguna"
          >
            <div className="header-avatar">{userInitial}</div>

            <div className="header-user-info">
              <span className="header-user-name">{userName}</span>
              <span className="header-user-role">Pemilik Usaha</span>
            </div>

            <svg
              className="header-chevron"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {menuOpen && (
            <div className="header-user-dropdown">
              <div className="dropdown-user-info">
                <strong>{userName}</strong>
                <span>{user?.email || ""}</span>
              </div>

              <div className="dropdown-divider"></div>

              <button
                type="button"
                className="dropdown-logout"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <path d="M16 17l5-5-5-5" />
                  <path d="M21 12H9" />
                </svg>

                <span>{loggingOut ? "Keluar..." : "Logout"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;