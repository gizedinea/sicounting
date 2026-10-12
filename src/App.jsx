import { useState } from 'react'
import './App.css'
import { Link, Routes, Route } from 'react-router-dom'
import { useTheme } from './context/ThemeContext'

import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import Dashboard from './pages/dashboard/Dashboard'

import Kas from './pages/dashboard/kas/Kas'
import Pembelian from './pages/dashboard/pembelian/Pembelian'
import Penjualan from './pages/dashboard/penjualan/Penjualan'
import Utang from './pages/dashboard/utang/Utang'
import Piutang from './pages/dashboard/piutang/Piutang'
import Inventory from './pages/dashboard/inventory/Inventory'
import Beban from './pages/dashboard/beban/Beban'
import Bukubesar from './pages/dashboard/bukubesar/Bukubesar'

const features = [
  {
    icon: '▥',
    title: 'Pembukuan Otomatis',
    description:
      'Catat transaksi bisnis dengan lebih mudah dan terorganisir dalam satu tempat.',
    color: 'green',
  },
  {
    icon: '⬡',
    title: 'Aman & Terpercaya',
    description:
      'Data keuangan bisnis tersimpan dengan sistem yang dirancang untuk keamanan.',
    color: 'blue',
  },
  {
    icon: '◉',
    title: 'Analisis Keuangan',
    description:
      'Pahami kondisi keuangan bisnis melalui informasi yang lebih mudah dipahami.',
    color: 'green',
  },
  {
    icon: '↗',
    title: 'Laporan Lebih Cepat',
    description:
      'Dapatkan ringkasan keuangan yang membantu kamu mengambil keputusan bisnis.',
    color: 'blue',
  },
]

const transactions = [
  {
    name: 'Penjualan Produk',
    date: '28 Sep 2026',
    amount: '+ Rp850.000',
    type: 'income',
  },
  {
    name: 'Pembelian Stok',
    date: '27 Sep 2026',
    amount: '- Rp320.000',
    type: 'expense',
  },
  {
    name: 'Penjualan Produk',
    date: '26 Sep 2026',
    amount: '+ Rp640.000',
    type: 'income',
  },
]

function Logo() {
  return (
    <a className="brand" href="#home" aria-label="Sicounting Beranda">
      <span className="brand-mark">S</span>
      <span>
        sicounting<span className="brand-dot">.</span>
      </span>
    </a>
  )
}

function ThemeIcon({ dark }) {
  if (dark) {
    return (
      <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2" />
        <path d="M12 20v2" />
        <path d="M4.93 4.93l1.42 1.42" />
        <path d="M17.65 17.65l1.42 1.42" />
        <path d="M2 12h2" />
        <path d="M20 12h2" />
        <path d="M4.93 19.07l1.42-1.42" />
        <path d="M17.65 6.35l1.42-1.42" />
      </svg>
    )
  }

  return (
    <svg className="theme-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.5 15.4A8.5 8.5 0 0 1 8.6 3.5 8.6 8.6 0 1 0 20.5 15.4Z" />
    </svg>
  )
}

function DashboardPreview() {
  return (
    <div className="dashboard-wrap" aria-label="Ilustrasi dashboard keuangan Sicounting">
      <div className="dashboard-orb orb-one" />
      <div className="dashboard-orb orb-two" />

      <div className="dashboard-card">
        <div className="dashboard-top">
          <div className="dashboard-brand">
            <span className="mini-mark">S</span>
            <div>
              <strong>Sicounting</strong>
              <span>Business Overview</span>
            </div>
          </div>
          <span className="online-dot">● Online</span>
        </div>

        <div className="dashboard-welcome">
          <div>
            <span className="muted-label">Ringkasan keuangan</span>
            <h3>Selamat datang!</h3>
          </div>
          <span className="calendar-icon">▦</span>
        </div>

        <div className="summary-grid">
          <div className="summary-box">
            <span>Total Pemasukan</span>
            <strong>Rp12,8 jt</strong>
            <small className="positive">↗ 12,8%</small>
          </div>
          <div className="summary-box">
            <span>Total Pengeluaran</span>
            <strong>Rp7,2 jt</strong>
            <small className="negative">↗ 4,2%</small>
          </div>
        </div>

        <div className="chart-box">
          <div className="chart-heading">
            <div>
              <strong>Arus Keuangan</strong>
              <span>Performa bisnis kamu</span>
            </div>
            <span className="chart-period">7 hari⌄</span>
          </div>

          <div className="chart-area">
            <div className="chart-y-labels">
              <span>3 jt</span>
              <span>2 jt</span>
              <span>1 jt</span>
              <span>0</span>
            </div>

            <svg
              className="chart-svg"
              viewBox="0 0 340 125"
              preserveAspectRatio="none"
              role="img"
              aria-label="Grafik arus keuangan ilustratif"
            >
              <defs>
                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#20c982" stopOpacity=".25" />
                  <stop offset="100%" stopColor="#20c982" stopOpacity="0" />
                </linearGradient>
              </defs>

              <path className="chart-gridline" d="M0 12H340 M0 44H340 M0 76H340 M0 108H340" />

              <path
                d="M0 96 C22 83 30 88 48 72 S80 85 102 61 S136 68 157 46 S193 65 218 35 S257 49 278 25 S315 34 340 9 V125 H0 Z"
                fill="url(#chartFill)"
              />

              <path
                d="M0 96 C22 83 30 88 48 72 S80 85 102 61 S136 68 157 46 S193 65 218 35 S257 49 278 25 S315 34 340 9"
                fill="none"
                stroke="#20c982"
                strokeWidth="3"
                strokeLinecap="round"
              />

              <path
                d="M0 112 C28 106 44 113 66 97 S104 107 130 90 S164 104 192 85 S230 96 254 78 S306 87 340 65"
                fill="none"
                stroke="#2585ed"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="5 5"
              />
            </svg>
          </div>

          <div className="chart-days">
            <span>Sen</span>
            <span>Sel</span>
            <span>Rab</span>
            <span>Kam</span>
            <span>Jum</span>
            <span>Sab</span>
            <span>Min</span>
          </div>
        </div>

        <div className="dashboard-bottom">
          <div className="bottom-icon">↗</div>
          <div>
            <span>Estimasi keuntungan</span>
            <strong>Rp5.600.000</strong>
          </div>
          <span className="bottom-growth">+18,4%</span>
        </div>
      </div>

      <div className="floating-card floating-income">
        <span className="floating-icon income-icon">↗</span>
        <div>
          <small>Pemasukan hari ini</small>
          <strong>+ Rp850.000</strong>
        </div>
      </div>

      <div className="floating-card floating-status">
        <span className="status-check">✓</span>
        <div>
          <strong>Data tersimpan</strong>
          <small>Keuangan lebih teratur</small>
        </div>
      </div>
    </div>
  )
}

function LandingPage() {
  const { theme, toggleTheme } = useTheme()
  const darkMode = theme === 'dark'
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className={`site theme-${theme}`}>
      <header className="navbar">
        <div className="container nav-inner">
          <Logo />

          <button
            className="mobile-menu-button"
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={menuOpen}
          >
            <span />
            <span />
            <span />
          </button>

          <nav className={`nav-links ${menuOpen ? 'nav-open' : ''}`}>
            <a href="#home" onClick={closeMenu}>Beranda</a>
            <a href="#features" onClick={closeMenu}>Fitur</a>
            <a href="#about" onClick={closeMenu}>Tentang</a>
            <a href="#contact" onClick={closeMenu}>Kontak</a>
          </nav>

          <div className="nav-actions">
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={darkMode ? 'Aktifkan light mode' : 'Aktifkan dark mode'}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              <ThemeIcon dark={darkMode} />
            </button>

            <Link className="button button-primary nav-cta" to="/login">
              Mulai Sekarang <span>↗</span>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero section" id="home">
          <div className="container hero-grid">
            <div className="hero-content">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Solusi Keuangan dan Bisnis
              </span>

              <h1>
                Pahami Keuangan.
                <br />
                <span className="gradient-text">Kembangkan Bisnis.</span>
              </h1>

              <p className="hero-description">
                Sicounting membantu pemilik bisnis mencatat transaksi dan memahami kondisi
                keuangan bisnis dengan lebih mudah.
              </p>

              <div className="hero-buttons">
                <Link className="button button-primary" to="/login">
                  Mulai Sekarang <span>→</span>
                </Link>
                <a className="button button-secondary" href="#features">
                  Pelajari Lebih Lanjut
                </a>
              </div>

              <div className="hero-note">
                <span className="note-avatars">
                  <span>G</span>
                  <span>B</span>
                  <span>U</span>
                </span>
                <p>
                  <strong>Kelola dengan lebih terarah.</strong>
                  <br />
                  Satu tempat untuk memahami bisnis.
                </p>
              </div>
            </div>

            <DashboardPreview />
          </div>
        </section>

        <section className="features-section section" id="features">
          <div className="container">
            <div className="section-heading centered">
              <span className="eyebrow">Fitur Sicounting</span>
              <h2>
                Semua yang kamu butuhkan,{' '}
                <span className="gradient-text">dalam satu tempat.</span>
              </h2>
              <p>
                Kelola dan pahami informasi keuangan bisnis dengan lebih terstruktur.
              </p>
            </div>

            <div className="features-grid">
              {features.map((feature) => (
                <article className="feature-card" key={feature.title}>
                  <div className={`feature-icon ${feature.color}`}>{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                  <a className="feature-link" href="#get-started">
                    Pelajari fitur <span>→</span>
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="about-section section" id="about">
          <div className="container about-grid">
            <div className="about-visual">
              <div className="about-glow" />

              <div className="report-window">
                <div className="report-top">
                  <div className="report-dots">
                    <i />
                    <i />
                    <i />
                  </div>
                  <span>Laporan Keuangan</span>
                  <span className="report-menu">•••</span>
                </div>

                <div className="report-title">
                  <span>Ringkasan laporan</span>
                  <strong>September 2026</strong>
                </div>

                <div className="report-stat-row">
                  <div>
                    <span>Pemasukan</span>
                    <strong>Rp12,8 jt</strong>
                  </div>
                  <div>
                    <span>Pengeluaran</span>
                    <strong>Rp7,2 jt</strong>
                  </div>
                </div>

                <div className="report-bars">
                  {[35, 52, 44, 68, 57, 82, 72, 94, 75, 100, 87, 112].map(
                    (height, i) => (
                      <span key={i} style={{ height: `${height}px` }} />
                    ),
                  )}
                </div>

                <div className="report-legend">
                  <span>● Pemasukan</span>
                  <span>● Pengeluaran</span>
                </div>
              </div>

              <div className="report-floating">
                <span className="report-floating-icon">✓</span>
                <div>
                  <small>Laporan siap</small>
                  <strong>Data lebih terstruktur</strong>
                </div>
              </div>
            </div>

            <div className="about-content">
              <span className="eyebrow">Tentang Sicounting</span>
              <h2>
                Lebih dari sekadar mencatat{' '}
                <span className="gradient-text">angka.</span>
              </h2>
              <p>
                Sicounting dirancang untuk membantu pemilik bisnis mengubah catatan transaksi
                menjadi informasi keuangan yang lebih mudah dipahami.
              </p>

              <ul className="benefit-list">
                <li><span>✓</span> Catatan transaksi lebih terstruktur</li>
                <li><span>✓</span> Ringkasan kondisi keuangan</li>
                <li><span>✓</span> Informasi pemasukan dan pengeluaran</li>
                <li><span>✓</span> Membantu pengambilan keputusan bisnis</li>
              </ul>

              <Link className="button button-primary" to="/login">
                Kenali Sicounting <span>→</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="stats-section">
          <div className="container stats-grid">
            <div className="stat-item">
              <strong>10<span>K+</span></strong>
              <span>Pengguna Aktif</span>
            </div>
            <div className="stat-item">
              <strong>99<span>.9%</span></strong>
              <span>Uptime Sistem</span>
            </div>
            <div className="stat-item">
              <strong>5<span>K+</span></strong>
              <span>Transaksi Tercatat</span>
            </div>
            <div className="stat-item">
              <strong>4<span>.8/5</span></strong>
              <span>Rating Pengguna</span>
            </div>
          </div>
          <p className="stats-disclaimer">
            Angka di atas merupakan data ilustrasi sementara.
          </p>
        </section>

        <section className="transactions-section section">
          <div className="container transactions-layout">
            <div className="transactions-copy">
              <span className="eyebrow">Lebih Terorganisir</span>
              <h2>
                Catatan rapi, keputusan bisnis{' '}
                <span className="gradient-text">lebih terarah.</span>
              </h2>
              <p>
                Kelola catatan pemasukan dan pengeluaran agar kondisi bisnis lebih mudah
                dipantau.
              </p>
              <a className="text-link" href="#get-started">
                Jelajahi Sicounting <span>→</span>
              </a>
            </div>

            <div className="transactions-card">
              <div className="transactions-heading">
                <div>
                  <span className="muted-label">Aktivitas terbaru</span>
                  <h3>Transaksi</h3>
                </div>
                <span className="transaction-filter">Bulan ini⌄</span>
              </div>

              {transactions.map((transaction, index) => (
                <div
                  className="transaction-row"
                  key={`${transaction.name}-${index}`}
                >
                  <span className={`transaction-icon ${transaction.type}`}>
                    {transaction.type === 'income' ? '↙' : '↗'}
                  </span>
                  <div className="transaction-name">
                    <strong>{transaction.name}</strong>
                    <span>{transaction.date}</span>
                  </div>
                  <strong
                    className={
                      transaction.type === 'income'
                        ? 'income-amount'
                        : 'expense-amount'
                    }
                  >
                    {transaction.amount}
                  </strong>
                </div>
              ))}

              <div className="transactions-footer">
                <span>Menampilkan data ilustrasi</span>
                <span className="transaction-arrow">↗</span>
              </div>
            </div>
          </div>
        </section>

        <section className="cta-section section" id="get-started">
          <div className="container">
            <div className="cta-card">
              <div className="cta-decoration cta-decoration-one" />
              <div className="cta-decoration cta-decoration-two" />

              <div className="cta-content">
                <span className="eyebrow">Siap Memulai?</span>
                <h2>
                  Kenali kondisi bisnismu dengan cara yang lebih mudah.
                </h2>
                <p>
                  Mulai kelola informasi keuangan bisnis dengan lebih terarah.
                </p>
                <Link className="button button-cta" to="/login">
                  Mulai Sekarang <span>→</span>
                </Link>
              </div>

              <div className="cta-graphic" aria-hidden="true">
                <div className="cta-document">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="cta-check">✓</div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer" id="contact">
        <div className="container footer-main">
          <div className="footer-brand">
            <Logo />
            <p>
              Membantu pemilik bisnis memahami kondisi keuangan dengan lebih mudah.
            </p>
            <div className="social-links">
              <a href="#contact" aria-label="Instagram">ig</a>
              <a href="#contact" aria-label="LinkedIn">in</a>
              <a href="#contact" aria-label="Email">@</a>
            </div>
          </div>

          <div className="footer-column">
            <strong>Jelajahi</strong>
            <a href="#home">Beranda</a>
            <a href="#features">Fitur</a>
            <a href="#about">Tentang Kami</a>
          </div>

          <div className="footer-column">
            <strong>Informasi</strong>
            <a href="#contact">Kontak</a>
            <a href="#contact">Kebijakan Privasi</a>
            <a href="#contact">Syarat Penggunaan</a>
          </div>

          <div className="footer-column footer-contact">
            <strong>Hubungi Kami</strong>
            <span>hello@sicounting.example</span>
            <span>Indonesia</span>
          </div>
        </div>

        <div className="container footer-bottom">
          <span>© 2026 Sicounting. All rights reserved.</span>
          <span>Dibuat untuk membantu bisnis berkembang.</span>
        </div>
      </footer>
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={<Dashboard />} />

      <Route path="/dashboard/kas" element={<Kas />} />
      <Route path="/dashboard/pembelian" element={<Pembelian />} />
      <Route path="/dashboard/penjualan" element={<Penjualan />} />
      <Route path="/dashboard/utang" element={<Utang />} />
      <Route path="/dashboard/piutang" element={<Piutang />} />
      <Route path="/dashboard/inventory" element={<Inventory />} />
      <Route path="/dashboard/beban" element={<Beban />} />

      {/* Route Buku Besar */}
      <Route path="/dashboard/bukubesar" element={<Bukubesar />} />

      <Route path="*" element={<h2>Halaman tidak ditemukan</h2>} />
    </Routes>
  )
}

export default App