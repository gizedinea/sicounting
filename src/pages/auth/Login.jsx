import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext";
import "./Auth.css";
function Login() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setLoading(true);
    setPesan("");

    // =========================
    // LOGIN SUPABASE AUTH
    // =========================
    const { data: authData, error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    // Jika login gagal
    if (loginError) {
      setPesan("Email atau password salah.");
      setLoading(false);
      return;
    }

    // =========================
    // CEK USER
    // =========================
    const user = authData.user;

    if (!user) {
      setPesan("User tidak ditemukan.");
      setLoading(false);
      return;
    }

    // =========================
    // AMBIL DATA public.users
    // =========================
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("nama, nama_usaha, jenis_usaha, role")
      .eq("id", user.id)
      .single();

    // Jika data profile tidak ditemukan
    if (userError || !userData) {
      console.error("User profile error:", userError);

      setPesan("Data pengguna tidak ditemukan.");
      setLoading(false);

      // Logout kembali
      await supabase.auth.signOut();

      return;
    }

    // =========================
    // CEK ROLE
    // =========================
    if (
      userData.role !== "admin" &&
      userData.role !== "user"
    ) {
      setPesan("Role pengguna tidak valid.");
      setLoading(false);

      await supabase.auth.signOut();

      return;
    }

    setLoading(false);

    // =========================
    // MASUK KE DASHBOARD
    // =========================
    navigate("/dashboard", {
      state: {
        role: userData.role,
      },
    });
  };

  return (
    <main className={`auth-page theme-${theme}`}>
      <section className="auth-card">

        {/* LOGO */}
        <div className="auth-logo">
          <div className="auth-logo-mark">
            S
          </div>

          <span>
            Sicounting
            <span className="auth-logo-dot">
              .
            </span>
          </span>
        </div>

        {/* JUDUL */}
        <h1>
          Masuk ke Sicounting
        </h1>

        <p className="auth-description">
          Kelola keuangan bisnis Anda dengan lebih mudah dan terstruktur.
        </p>

        {/* FORM */}
        <form
          className="auth-form"
          onSubmit={handleLogin}
        >

          {/* EMAIL */}
          <div className="auth-field">
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="Masukkan email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>

          {/* PASSWORD */}
          <div className="auth-field password-field">
            <label htmlFor="password">
              Password
            </label>

            <div
              className="password-box"
              style={{
                position: "relative",
                width: "100%",
                height: "47px",
              }}
            >

              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Masukkan password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                autoComplete="current-password"
                required
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "47px",
                  padding: "0 52px 0 14px",
                }}
              />

              {/* TOGGLE PASSWORD */}
              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (current) => !current
                  )
                }
                aria-label={
                  showPassword
                    ? "Sembunyikan password"
                    : "Tampilkan password"
                }
                style={{
                  position: "absolute",
                  top: "50%",
                  right: "8px",
                  left: "auto",
                  bottom: "auto",
                  transform: "translateY(-50%)",

                  width: "36px",
                  height: "36px",
                  minWidth: "36px",
                  minHeight: "36px",

                  margin: 0,
                  padding: 0,

                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",

                  border: "none",
                  borderRadius: "8px",

                  background: "transparent",
                  color: "var(--muted)",

                  appearance: "none",
                  WebkitAppearance: "none",

                  boxShadow: "none",

                  cursor: "pointer",

                  zIndex: 100,
                }}
              >

                {showPassword ? (

                  /* EYE OFF */
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      display: "block",
                      width: "20px",
                      height: "20px",
                      pointerEvents: "none",
                    }}
                  >
                    <path d="M3 3l18 18" />

                    <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />

                    <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5 0 9.3 3.1 10.5 8-0.4 1.6-1.2 3-2.2 4.1" />

                    <path d="M6.6 6.6C4.8 7.9 3.5 9.7 1.5 12c1.2 4.9 5.5 8 10.5 8 1.7 0 3.3-.4 4.7-1" />
                  </svg>

                ) : (

                  /* EYE */
                  <svg
                    viewBox="0 0 24 24"
                    width="20"
                    height="20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      display: "block",
                      width: "20px",
                      height: "20px",
                      pointerEvents: "none",
                    }}
                  >
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />

                    <circle
                      cx="12"
                      cy="12"
                      r="3"
                    />
                  </svg>

                )}

              </button>
            </div>
          </div>

          {/* PESAN ERROR */}
          {pesan && (
            <p className="auth-message">
              {pesan}
            </p>
          )}

          {/* BUTTON LOGIN */}
          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Memproses..."
              : "Masuk"}
          </button>

        </form>

        {/* REGISTER */}
        <p className="auth-footer">
          Belum punya akun?{" "}

          <Link to="/register">
            Daftar sekarang
          </Link>
        </p>

        {/* BACK */}
        <div className="auth-back">
          <Link to="/">
            ← Kembali ke halaman utama
          </Link>
        </div>

      </section>
    </main>
  );
}

export default Login;