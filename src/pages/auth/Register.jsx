import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";
import { useTheme } from "../../context/ThemeContext";

function Register() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [nama, setNama] = useState("");
  const [namaUsaha, setNamaUsaha] = useState("");
  const [jenisUsaha, setJenisUsaha] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pesan, setPesan] = useState("");
  const [passwordError, setPasswordError] = useState(false);

  // ==========================================
  // VALIDASI PASSWORD
  // ==========================================
  const validatePassword = (value) => {
    return {
      length: value.length >= 8,
      letter: /[A-Za-z]/.test(value),
      number: /[0-9]/.test(value),
      symbol: /[^A-Za-z0-9]/.test(value),
    };
  };

  const passwordRules = validatePassword(password);

  const isPasswordValid =
    passwordRules.length &&
    passwordRules.letter &&
    passwordRules.number &&
    passwordRules.symbol;

  // ==========================================
  // REGISTER
  // ==========================================
  const handleRegister = async (e) => {
    e.preventDefault();

    setPesan("");

    // Validasi password
    if (!isPasswordValid) {
      setPasswordError(true);
      return;
    }

    setPasswordError(false);
    setLoading(true);

    try {
      // ========================================
      // REGISTER KE SUPABASE AUTH
      // ========================================
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,

        options: {
          data: {
            // Untuk Display Name di Supabase Auth
            display_name: nama.trim(),

            // Data yang akan dibaca oleh trigger
            nama: nama.trim(),
            nama_usaha: namaUsaha.trim(),
            jenis_usaha: jenisUsaha,
          },
        },
      });

      // ========================================
      // CEK ERROR SUPABASE
      // ========================================
      if (error) {
        console.error("=== REGISTER ERROR ===");
        console.error("Message:", error.message);
        console.error("Code:", error.code);
        console.error("Status:", error.status);
        console.error("Hint:", error.hint);
        console.error("Details:", error.details);

        setPesan(error.message);
        return;
      }

      // ========================================
      // PROTEKSI EMAIL SUDAH TERDAFTAR
      // ========================================
      if (data.user?.identities?.length === 0) {
        setPesan("Email sudah terdaftar.");
        return;
      }

      /*
       * ========================================
       * PUBLIC.USERS
       * ========================================
       *
       * Data public.users TIDAK dimasukkan
       * langsung dari React.
       *
       * Setelah auth.users berhasil dibuat,
       * trigger Supabase akan otomatis menjalankan:
       *
       * public.handle_new_user()
       *
       * dan membuat data pada public.users.
       */

      // ========================================
      // EMAIL CONFIRMATION AKTIF
      // ========================================
      if (!data.session) {
        setPesan(
          "Registrasi berhasil. Silakan cek email Anda untuk melakukan konfirmasi."
        );

        setTimeout(() => {
          navigate("/login");
        }, 2000);

        return;
      }

      // ========================================
      // EMAIL CONFIRMATION NONAKTIF
      // ========================================
      setPesan("Registrasi berhasil. Silakan masuk.");

      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (error) {
      console.error("=== REGISTER EXCEPTION ===");
      console.error(error);

      setPesan(
        error?.message ||
          "Terjadi kesalahan saat melakukan registrasi."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={`auth-page theme-${theme}`}>
      <section className="auth-card">

        {/* ======================================
            LOGO
        ====================================== */}
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

        {/* ======================================
            HEADER
        ====================================== */}
        <h1>Buat Akun Sicounting</h1>

        <p className="auth-description">
          Mulai kelola keuangan bisnis Anda dengan
          lebih mudah dan terstruktur.
        </p>

        {/* ======================================
            FORM
        ====================================== */}
        <form
          className="auth-form"
          onSubmit={handleRegister}
        >

          {/* ====================================
              NAMA
          ==================================== */}
          <div className="auth-field">
            <label htmlFor="nama">
              Nama
            </label>

            <input
              id="nama"
              type="text"
              placeholder="Masukkan nama"
              value={nama}
              onChange={(e) =>
                setNama(e.target.value)
              }
              autoComplete="name"
              required
            />
          </div>

          {/* ====================================
              NAMA USAHA
          ==================================== */}
          <div className="auth-field">
            <label htmlFor="namaUsaha">
              Nama Usaha
            </label>

            <input
              id="namaUsaha"
              type="text"
              placeholder="Masukkan nama usaha"
              value={namaUsaha}
              onChange={(e) =>
                setNamaUsaha(e.target.value)
              }
              required
            />
          </div>

          {/* ====================================
              JENIS USAHA
          ==================================== */}
          <div className="auth-field">
            <label htmlFor="jenisUsaha">
              Jenis Usaha
            </label>

            <select
              id="jenisUsaha"
              value={jenisUsaha}
              onChange={(e) =>
                setJenisUsaha(e.target.value)
              }
              required
            >
              <option value="" disabled>
                Pilih jenis usaha
              </option>

              <option value="Toko Mebel dan Furnitur">
                Toko Mebel dan Furnitur
              </option>

              <option value="Toko Elektronik">
                Toko Elektronik
              </option>

              <option value="Toko Bahan Bangunan">
                Toko Bahan Bangunan
              </option>

              <option value="Toko Pakaian dan Fashion">
                Toko Pakaian dan Fashion
              </option>

              <option value="Toko Sembako">
                Toko Sembako
              </option>

              <option value="Toko Kelontong">
                Toko Kelontong
              </option>

              <option value="Toko Peralatan Rumah Tangga">
                Toko Peralatan Rumah Tangga
              </option>

              <option value="Toko Komputer dan Aksesori">
                Toko Komputer dan Aksesori
              </option>

              <option value="Toko Bangunan dan Perkakas">
                Toko Bangunan dan Perkakas
              </option>

              <option value="Toko Otomotif dan Suku Cadang">
                Toko Otomotif dan Suku Cadang
              </option>

              <option value="Toko Kosmetik">
                Toko Kosmetik
              </option>

              <option value="Toko Alat Tulis dan Perlengkapan Kantor">
                Toko Alat Tulis dan Perlengkapan Kantor
              </option>

              <option value="Toko Pertanian dan Peternakan">
                Toko Pertanian dan Peternakan
              </option>

              <option value="Toko Grosir dan Distributor">
                Toko Grosir dan Distributor
              </option>

              <option value="Reseller dan Dropshipper">
                Reseller dan Dropshipper
              </option>

              <option value="Kuliner">
                Kuliner
              </option>

              <option value="Jasa">
                Jasa
              </option>

              <option value="Manufaktur">
                Manufaktur
              </option>

              <option value="Pertanian">
                Pertanian
              </option>

              <option value="Peternakan">
                Peternakan
              </option>

              <option value="Lainnya">
                Lainnya
              </option>
            </select>
          </div>

          {/* ====================================
              EMAIL
          ==================================== */}
          <div className="auth-field">
            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              type="email"
              placeholder="Masukkan email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              autoComplete="email"
              required
            />
          </div>

          {/* ====================================
              PASSWORD
          ==================================== */}
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
                placeholder="Minimal 8 karakter"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setPasswordError(false);
                }}
                autoComplete="new-password"
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

              {/* ==================================
                  TOGGLE PASSWORD
              ================================== */}
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
                  transform:
                    "translateY(-50%)",

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
                  // =================================
                  // ICON PASSWORD TERBUKA
                  // =================================
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
                  // =================================
                  // ICON PASSWORD TERTUTUP
                  // =================================
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

            {/* ==================================
                PASSWORD VALIDATION
            ================================== */}
            {passwordError && (
              <div className="password-validation">

                <strong>
                  Password belum memenuhi persyaratan
                </strong>

                <div
                  className={
                    passwordRules.length
                      ? "valid"
                      : "invalid"
                  }
                >
                  {passwordRules.length
                    ? "✓"
                    : "✕"}{" "}
                  Minimal 8 karakter
                </div>

                <div
                  className={
                    passwordRules.letter
                      ? "valid"
                      : "invalid"
                  }
                >
                  {passwordRules.letter
                    ? "✓"
                    : "✕"}{" "}
                  Mengandung huruf
                </div>

                <div
                  className={
                    passwordRules.number
                      ? "valid"
                      : "invalid"
                  }
                >
                  {passwordRules.number
                    ? "✓"
                    : "✕"}{" "}
                  Mengandung angka
                </div>

                <div
                  className={
                    passwordRules.symbol
                      ? "valid"
                      : "invalid"
                  }
                >
                  {passwordRules.symbol
                    ? "✓"
                    : "✕"}{" "}
                  Mengandung simbol
                </div>

              </div>
            )}
          </div>

          {/* ======================================
              PESAN ERROR / SUCCESS
          ====================================== */}
          {pesan && (
            <p className="auth-message">
              {pesan}
            </p>
          )}

          {/* ======================================
              BUTTON DAFTAR
          ====================================== */}
          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Memproses..."
              : "Daftar"}
          </button>

        </form>

        {/* ======================================
            LINK LOGIN
        ====================================== */}
        <p className="auth-footer">
          Sudah punya akun?{" "}

          <Link to="/login">
            Masuk sekarang
          </Link>
        </p>

        {/* ======================================
            KEMBALI
        ====================================== */}
        <div className="auth-back">
          <Link to="/">
            ← Kembali ke halaman utama
          </Link>
        </div>

      </section>
    </main>
  );
}

export default Register;