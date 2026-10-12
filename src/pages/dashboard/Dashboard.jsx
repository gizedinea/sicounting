import { useLocation, Navigate } from "react-router-dom";

import UserDashboard from "./UserDashboard";
import AdminDashboard from "./AdminDashboard";

function Dashboard() {
  const location = useLocation();

  // Ambil role yang dikirim dari Login
  const role = location.state?.role;

  // =========================
  // JIKA TIDAK ADA ROLE
  // =========================
  // Contoh:
  // user membuka /dashboard langsung
  if (!role) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // =========================
  // ADMIN
  // =========================
  if (role === "admin") {
    return <AdminDashboard />;
  }

  // =========================
  // USER
  // =========================
  if (role === "user") {
    return <UserDashboard />;
  }

  // =========================
  // ROLE TIDAK DIKENAL
  // =========================
  return (
    <Navigate
      to="/login"
      replace
    />
  );
}

export default Dashboard;