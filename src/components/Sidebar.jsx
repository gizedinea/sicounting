import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import "./Components.css";

const SIDEBAR_EVENT = "sicounting-sidebar-toggle";

function Sidebar() {
  const { theme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleSidebarToggle = (event) => {
      setMobileOpen(Boolean(event.detail?.open));
    };

    window.addEventListener(SIDEBAR_EVENT, handleSidebarToggle);

    return () => {
      window.removeEventListener(SIDEBAR_EVENT, handleSidebarToggle);
    };
  }, []);

  const closeMobileSidebar = () => {
    setMobileOpen(false);

    window.dispatchEvent(
      new CustomEvent(SIDEBAR_EVENT, {
        detail: { open: false },
      })
    );
  };

  const handleNavigationClick = (event) => {
    if (event.target.closest("a")) {
      closeMobileSidebar();
    }
  };

  const isActive = (path) => location.pathname === path;

  const getLinkClass = (path) =>
    `sidebar-link ${isActive(path) ? "active" : ""}`;

  return (
    <>
      {mobileOpen && (
        <div
          className="mobile-sidebar-overlay"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar sidebar-${theme} ${
          mobileOpen ? "sidebar-mobile-open" : ""
        }`}
      >
        {/* LOGO */}
        <div className="sidebar-logo">
          <Link
            to="/dashboard"
            className="logo-text"
            onClick={closeMobileSidebar}
            aria-label="Sicounting Dashboard"
          >
            Sicounting<span className="logo-dot">.</span>
          </Link>
        </div>

        <nav
          className="sidebar-nav"
          onClick={handleNavigationClick}
        >
          <div className="sidebar-section">
            <p className="sidebar-section-title">Jurnal</p>

            {/* JURNAL KAS */}
            <Link
              to="/dashboard/kas"
              className={getLinkClass("/dashboard/kas")}
              aria-current={
                isActive("/dashboard/kas") ? "page" : undefined
              }
            >
              <span className="sidebar-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="6" width="18" height="12" rx="2" />
                  <path d="M3 10h18" />
                  <circle cx="12" cy="14" r="2" />
                </svg>
              </span>
              <span>Jurnal Kas</span>
            </Link>

            {/* JURNAL PEMBELIAN */}
            <Link
              to="/dashboard/pembelian"
              className={getLinkClass("/dashboard/pembelian")}
              aria-current={
                isActive("/dashboard/pembelian") ? "page" : undefined
              }
            >
              <span className="sidebar-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 4h2l2.4 11.5a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 2-1.5L21 8H6" />
                  <circle cx="10" cy="20" r="1.5" />
                  <circle cx="18" cy="20" r="1.5" />
                </svg>
              </span>
              <span>Jurnal Pembelian</span>
            </Link>

            {/* JURNAL PENJUALAN */}
            <Link
              to="/dashboard/penjualan"
              className={getLinkClass("/dashboard/penjualan")}
              aria-current={
                isActive("/dashboard/penjualan") ? "page" : undefined
              }
            >
              <span className="sidebar-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 5h16v14H4z" />
                  <path d="M8 9h8" />
                  <path d="M8 13h5" />
                  <path d="M8 17h8" />
                </svg>
              </span>
              <span>Jurnal Penjualan</span>
            </Link>

            {/* JURNAL UTANG */}
            <Link
              to="/dashboard/utang"
              className={getLinkClass("/dashboard/utang")}
              aria-current={
                isActive("/dashboard/utang") ? "page" : undefined
              }
            >
              <span className="sidebar-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 3h12v18H6z" />
                  <path d="M9 7h6" />
                  <path d="M9 11h6" />
                  <path d="M9 15h4" />
                </svg>
              </span>
              <span>Jurnal Utang</span>
            </Link>

            {/* JURNAL PIUTANG */}
            <Link
              to="/dashboard/piutang"
              className={getLinkClass("/dashboard/piutang")}
              aria-current={
                isActive("/dashboard/piutang") ? "page" : undefined
              }
            >
              <span className="sidebar-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v10" />
                  <path d="M15 9.5c-.5-1-1.5-1.5-3-1.5-1.7 0-3 1-3 2.2 0 1.4 1.3 2 3 2.4 1.7.4 3 .9 3 2.4 0 1.3-1.3 2.2-3 2.2-1.5 0-2.5-.5-3-1.5" />
                </svg>
              </span>
              <span>Jurnal Piutang</span>
            </Link>

            {/* JURNAL INVENTORY */}
            <Link
              to="/dashboard/inventory"
              className={getLinkClass("/dashboard/inventory")}
              aria-current={
                isActive("/dashboard/inventory") ? "page" : undefined
              }
            >
              <span className="sidebar-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M21 8.5 12 4 3 8.5" />
                  <path d="M3 8.5v7L12 20l9-4.5v-7" />
                  <path d="M12 20v-8" />
                  <path d="M3 8.5 12 13l9-4.5" />
                  <path d="M16 5.8v4.4" />
                  <path d="M14 8h4" />
                </svg>
              </span>
              <span>Jurnal Inventory</span>
            </Link>

            {/* JURNAL BEBAN */}
            <Link
              to="/dashboard/beban"
              className={getLinkClass("/dashboard/beban")}
              aria-current={
                isActive("/dashboard/beban") ? "page" : undefined
              }
            >
              <span className="sidebar-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="3" width="16" height="18" rx="2" />
                  <path d="M8 8h8" />
                  <path d="M8 12h8" />
                  <path d="M8 16h3" />
                  <path d="M16 15v4" />
                </svg>
              </span>
              <span>Jurnal Beban</span>
            </Link>

            {/* BUKU BESAR */}
            <Link
              to="/dashboard/bukubesar"
              className={getLinkClass("/dashboard/bukubesar")}
              aria-current={
                isActive("/dashboard/bukubesar") ? "page" : undefined
              }
            >
              <span className="sidebar-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H20v18H7.5A2.5 2.5 0 0 0 5 22V4.5Z" />
                  <path d="M5 4.5V19" />
                  <path d="M9 7h7" />
                  <path d="M9 11h7" />
                  <path d="M9 15h5" />
                </svg>
              </span>
              <span>Buku Besar</span>
            </Link>
          </div>
        </nav>
      </aside>
    </>
  );
}

export default Sidebar;