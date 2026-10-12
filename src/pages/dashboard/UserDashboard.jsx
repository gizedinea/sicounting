import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import Sidebar from "../../components/Sidebar";
import Header from "../../components/Header";
import "./Dashboard.css";

const TABLES = [
  "kas",
  "pembelian",
  "penjualan",
  "utang",
  "piutang",
  "inventory",
  "beban",
];

const OWNER_COLUMNS = ["user_id", "users_id", "uuid"];

const AMOUNT_COLUMNS = [
  "nominal",
  "jumlah",
  "total",
  "total_harga",
  "total_bayar",
  "nilai_transaksi",
  "amount",
  "harga_total",
  "debit",
  "kredit",
];

const DATE_COLUMNS = [
  "tanggal",
  "tanggal_transaksi",
  "created_at",
  "updated_at",
  "tgl_transaksi",
];

const TYPE_COLUMNS = [
  "jenis_transaksi",
  "jenis",
  "tipe",
  "type",
  "kategori",
  "arus_kas",
];

const DESCRIPTION_COLUMNS = [
  "keterangan",
  "deskripsi",
  "nama_transaksi",
  "catatan",
  "uraian",
  "nama",
];

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatCompactRupiah = (value) => {
  const amount = Number(value) || 0;

  if (amount >= 1_000_000_000) {
    return `Rp${(amount / 1_000_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} M`;
  }

  if (amount >= 1_000_000) {
    return `Rp${(amount / 1_000_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }

  if (amount >= 1_000) {
    return `Rp${(amount / 1_000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} rb`;
  }

  return formatRupiah(amount);
};

const getDateValue = (row) => {
  for (const column of DATE_COLUMNS) {
    if (row[column]) {
      const date = new Date(row[column]);

      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return null;
};

const getAmount = (row) => {
  for (const column of AMOUNT_COLUMNS) {
    const value = row[column];

    if (value !== undefined && value !== null && value !== "") {
      const number = Number(value);

      if (Number.isFinite(number)) {
        return Math.abs(number);
      }
    }
  }

  const incoming = Number(row.pemasukan);
  const outgoing = Number(row.pengeluaran);

  if (Number.isFinite(incoming) && incoming > 0) {
    return incoming;
  }

  if (Number.isFinite(outgoing) && outgoing > 0) {
    return outgoing;
  }

  return 0;
};

const getTransactionType = (row) => {
  const values = TYPE_COLUMNS
    .map((column) => row[column])
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());

  for (const value of values) {
    if (
      value.includes("pemasukan") ||
      value.includes("masuk") ||
      value.includes("income") ||
      value.includes("terima")
    ) {
      return "income";
    }

    if (
      value.includes("pengeluaran") ||
      value.includes("keluar") ||
      value.includes("expense") ||
      value.includes("bayar") ||
      value.includes("beban")
    ) {
      return "expense";
    }
  }

  if (Number(row.pemasukan) > 0) return "income";
  if (Number(row.pengeluaran) > 0) return "expense";

  return "other";
};

const getDescription = (row) => {
  for (const column of DESCRIPTION_COLUMNS) {
    if (row[column]) {
      return String(row[column]);
    }
  }

  const type = getTransactionType(row);

  if (type === "income") return "Pemasukan";
  if (type === "expense") return "Pengeluaran";

  return "Transaksi";
};

const formatDate = (date) => {
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const isCurrentMonth = (date, now = new Date()) => {
  return (
    date &&
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
};

const getMonthName = (date) =>
  new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(date);

const getWeekOfMonth = (date) => Math.ceil(date.getDate() / 7);

async function fetchUserTable(table, userId) {
  let lastError = null;

  for (const ownerColumn of OWNER_COLUMNS) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(ownerColumn, userId);

    if (!error) {
      return {
        data: data || [],
        error: null,
      };
    }

    lastError = error;

    // Coba nama kolom pemilik lain jika kolom ini tidak tersedia.
    const message = String(error.message || "").toLowerCase();

    const isColumnError =
      message.includes("column") ||
      message.includes("schema cache") ||
      message.includes("does not exist");

    if (!isColumnError) {
      break;
    }
  }

  return {
    data: [],
    error: lastError,
  };
}

function UserDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [userName, setUserName] = useState("");
  const [cashRows, setCashRows] = useState([]);
  const [allJournalRows, setAllJournalRows] = useState([]);
  const [missingTables, setMissingTables] = useState([]);
  const [period, setPeriod] = useState("month");
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async (showLoading = false) => {
    if (showLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    setErrorMessage("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData?.user;

      if (!user) {
        setCashRows([]);
        setAllJournalRows([]);
        setUserName("");
        setErrorMessage("Sesi login tidak ditemukan. Silakan login kembali.");
        return;
      }

      setUserName(
        user.user_metadata?.nama ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Pengguna"
      );

      // Ambil jurnal berdasarkan ID pengguna yang sedang login.
      const results = await Promise.all(
        TABLES.map(async (table) => {
          const result = await fetchUserTable(table, user.id);

          return {
            table,
            ...result,
          };
        })
      );

      const unavailable = results
        .filter((result) => result.error)
        .map((result) => result.table);

      setMissingTables(unavailable);

      const kasResult = results.find((result) => result.table === "kas");

      if (kasResult?.error) {
        setErrorMessage(
          "Data jurnal kas belum bisa dibaca. Periksa nama kolom pemilik dan kebijakan RLS Supabase."
        );
      }

      const cashData = (kasResult?.data || []).map((row) => ({
        ...row,
        _source: "kas",
      }));

      setCashRows(cashData);

      const journals = results.flatMap((result) =>
        result.data.map((row) => ({
          ...row,
          _source: result.table,
        }))
      );

      setAllJournalRows(journals);
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Gagal memuat dashboard:", error);
      setErrorMessage(
        error.message || "Terjadi kesalahan ketika memuat data dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard(true);

    let channel = null;
    let cancelled = false;

    const subscribeToChanges = async () => {
      const { data } = await supabase.auth.getUser();

      if (cancelled || !data?.user) return;

      channel = supabase.channel(`dashboard-${data.user.id}`);

      TABLES.forEach((table) => {
        channel = channel.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
          },
          () => {
            loadDashboard(false);
          }
        );
      });

      channel.subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.error(
            "Realtime belum tersambung. Pastikan tabel masuk ke publikasi supabase_realtime."
          );
        }
      });
    };

    subscribeToChanges();

    return () => {
      cancelled = true;

      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [loadDashboard]);

  const now = new Date();

  const currentCashRows = useMemo(() => {
    return cashRows.filter((row) => {
      const date = getDateValue(row);
      return isCurrentMonth(date, now);
    });
  }, [cashRows, now.getFullYear(), now.getMonth()]);

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;

    currentCashRows.forEach((row) => {
      const amount = getAmount(row);
      const type = getTransactionType(row);

      if (type === "income") {
        income += amount;
      } else if (type === "expense") {
        expense += amount;
      }
    });

    const profit = income - expense;
    const margin = income > 0 ? (profit / income) * 100 : 0;

    return {
      income,
      expense,
      profit,
      margin,
      count: currentCashRows.length,
    };
  }, [currentCashRows]);

  const chartData = useMemo(() => {
    const weeks = [
      { label: "Mg 1", income: 0, expense: 0 },
      { label: "Mg 2", income: 0, expense: 0 },
      { label: "Mg 3", income: 0, expense: 0 },
      { label: "Mg 4", income: 0, expense: 0 },
      { label: "Mg 5", income: 0, expense: 0 },
    ];

    currentCashRows.forEach((row) => {
      const date = getDateValue(row);
      if (!date) return;

      const index = getWeekOfMonth(date) - 1;
      if (!weeks[index]) return;

      const amount = getAmount(row);
      const type = getTransactionType(row);

      if (type === "income") {
        weeks[index].income += amount;
      } else if (type === "expense") {
        weeks[index].expense += amount;
      }
    });

    return weeks;
  }, [currentCashRows]);

  const chartMax = Math.max(
    1,
    ...chartData.map((item) => Math.max(item.income, item.expense))
  );

  const latestTransactions = useMemo(() => {
    return [...cashRows]
      .map((row) => ({
        ...row,
        _date: getDateValue(row),
        _amount: getAmount(row),
        _type: getTransactionType(row),
        _description: getDescription(row),
      }))
      .sort((a, b) => {
        return (b._date?.getTime() || 0) - (a._date?.getTime() || 0);
      })
      .slice(0, 5);
  }, [cashRows]);

  const periodLabel =
    period === "month"
      ? getMonthName(now)
      : period === "all"
        ? "Semua Periode"
        : "7 Hari Terakhir";

  const filteredCashRows = useMemo(() => {
    if (period === "all") return cashRows;

    return cashRows.filter((row) => {
      const date = getDateValue(row);
      if (!date) return false;

      if (period === "month") {
        return isCurrentMonth(date, now);
      }

      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      return date >= start && date <= now;
    });
  }, [cashRows, period, now.getFullYear(), now.getMonth(), now.getDate()]);

  const periodStats = useMemo(() => {
    let income = 0;
    let expense = 0;

    filteredCashRows.forEach((row) => {
      const amount = getAmount(row);
      const type = getTransactionType(row);

      if (type === "income") income += amount;
      if (type === "expense") expense += amount;
    });

    return {
      income,
      expense,
      profit: income - expense,
      count: filteredCashRows.length,
    };
  }, [filteredCashRows]);

  return (
    <div className="dashboard-page">
      <Sidebar />

      <div className="dashboard-main">
        <Header />

        <main className="dashboard-content">
          <section className="dashboard-welcome">
            <div>
              <h1>
                Selamat Datang{userName ? `, ${userName}` : ""}
              </h1>

              <p>
                Kelola dan pantau kondisi keuangan bisnismu dengan lebih mudah.
              </p>

              {lastUpdated && (
                <small className="dashboard-last-updated">
                  Terakhir diperbarui:{" "}
                  {lastUpdated.toLocaleTimeString("id-ID")}
                  {refreshing ? " · Memperbarui..." : ""}
                </small>
              )}
            </div>

            <div className="dashboard-date">
              <span>Periode</span>
              <strong>{periodLabel}</strong>
            </div>
          </section>

          {errorMessage && (
            <div className="dashboard-alert" role="alert">
              <strong>Perhatian:</strong> {errorMessage}
            </div>
          )}

          {missingTables.length > 0 && (
            <div className="dashboard-alert dashboard-alert-warning">
              Beberapa jurnal belum dapat dibaca: {missingTables.join(", ")}.
              Periksa tabel, kolom pemilik, dan kebijakan RLS Supabase.
            </div>
          )}

          {loading ? (
            <div className="dashboard-loading">
              <div className="dashboard-spinner" />
              <p>Memuat data keuangan...</p>
            </div>
          ) : (
            <>
              <section className="dashboard-summary">
                <div className="summary-card">
                  <div className="summary-card-top">
                    <span className="summary-label">Total Pemasukan</span>
                    <div className="summary-icon income-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 19V5" />
                        <path d="M6 11l6-6 6 6" />
                      </svg>
                    </div>
                  </div>

                  <h2>{formatRupiah(stats.income)}</h2>
                  <p className="summary-change positive">
                    Total pemasukan bulan ini
                  </p>
                </div>

                <div className="summary-card">
                  <div className="summary-card-top">
                    <span className="summary-label">Total Pengeluaran</span>
                    <div className="summary-icon expense-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 5v14" />
                        <path d="M18 13l-6 6-6-6" />
                      </svg>
                    </div>
                  </div>

                  <h2>{formatRupiah(stats.expense)}</h2>
                  <p className="summary-change negative">
                    Total pengeluaran bulan ini
                  </p>
                </div>

                <div className="summary-card">
                  <div className="summary-card-top">
                    <span className="summary-label">Estimasi Keuntungan</span>
                    <div className="summary-icon profit-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 3v18h18" />
                        <path d="M7 16l4-5 3 3 5-7" />
                      </svg>
                    </div>
                  </div>

                  <h2>{formatRupiah(stats.profit)}</h2>
                  <p
                    className={`summary-change ${
                      stats.profit >= 0 ? "positive" : "negative"
                    }`}
                  >
                    Margin {stats.margin.toLocaleString("id-ID", {
                      maximumFractionDigits: 1,
                    })}%
                  </p>
                </div>

                <div className="summary-card">
                  <div className="summary-card-top">
                    <span className="summary-label">Transaksi</span>
                    <div className="summary-icon transaction-icon">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <path d="M7 8h10" />
                        <path d="M7 12h6" />
                        <path d="M7 16h4" />
                      </svg>
                    </div>
                  </div>

                  <h2>{stats.count}</h2>
                  <p className="summary-change neutral">
                    Transaksi kas bulan ini
                  </p>
                </div>
              </section>

              <section className="dashboard-grid">
                <div className="dashboard-panel financial-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Ringkasan Keuangan</h2>
                      <p>Perbandingan pemasukan dan pengeluaran</p>
                    </div>

                    <select
                      className="panel-filter"
                      value={period}
                      onChange={(event) => setPeriod(event.target.value)}
                      aria-label="Pilih periode laporan"
                    >
                      <option value="month">Bulan Ini</option>
                      <option value="7days">7 Hari Terakhir</option>
                      <option value="all">Semua Periode</option>
                    </select>
                  </div>

                  <div className="financial-chart">
                    <div className="chart-y-axis">
                      <span>{formatCompactRupiah(chartMax)}</span>
                      <span>{formatCompactRupiah(chartMax * 0.75)}</span>
                      <span>{formatCompactRupiah(chartMax * 0.5)}</span>
                      <span>0</span>
                    </div>

                    <div className="chart-area">
                      <div className="chart-lines">
                        <span />
                        <span />
                        <span />
                        <span />
                      </div>

                      <div className="chart-bars">
                        {chartData.map((item) => (
                          <div className="chart-group" key={item.label}>
                            <div
                              className="bar income-bar"
                              title={`Pemasukan: ${formatRupiah(item.income)}`}
                              style={{
                                height: `${Math.max(
                                  item.income > 0 ? 3 : 0,
                                  (item.income / chartMax) * 100
                                )}%`,
                              }}
                            />

                            <div
                              className="bar expense-bar"
                              title={`Pengeluaran: ${formatRupiah(item.expense)}`}
                              style={{
                                height: `${Math.max(
                                  item.expense > 0 ? 3 : 0,
                                  (item.expense / chartMax) * 100
                                )}%`,
                              }}
                            />

                            <small>{item.label}</small>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="chart-legend">
                    <span>
                      <i className="legend-income" />
                      Pemasukan
                    </span>
                    <span>
                      <i className="legend-expense" />
                      Pengeluaran
                    </span>
                  </div>
                </div>

                <div className="dashboard-panel profit-panel">
                  <div className="panel-header">
                    <div>
                      <h2>Keuntungan</h2>
                      <p>{periodLabel}</p>
                    </div>
                  </div>

                  <div className="profit-content">
                    <div
                      className="profit-circle"
                      style={{
                        background: `conic-gradient(#20c982 ${
                          Math.max(0, Math.min(100, periodStats.income > 0
                            ? (periodStats.profit / periodStats.income) * 100
                            : 0))
                        }%, var(--dashboard-border, #e8edf2) 0)`,
                      }}
                    >
                      <div>
                        <strong>
                          {periodStats.income > 0
                            ? `${(
                                (periodStats.profit / periodStats.income) *
                                100
                              ).toLocaleString("id-ID", {
                                maximumFractionDigits: 1,
                              })}%`
                            : "0%"}
                        </strong>
                        <span>Margin</span>
                      </div>
                    </div>

                    <div className="profit-info">
                      <div>
                        <span>Pemasukan</span>
                        <strong>{formatCompactRupiah(periodStats.income)}</strong>
                      </div>
                      <div>
                        <span>Pengeluaran</span>
                        <strong>{formatCompactRupiah(periodStats.expense)}</strong>
                      </div>
                      <div>
                        <span>Laba</span>
                        <strong>{formatCompactRupiah(periodStats.profit)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="dashboard-panel transaction-panel">
                <div className="panel-header">
                  <div>
                    <h2>Transaksi Terbaru</h2>
                    <p>Aktivitas dari jurnal kas</p>
                  </div>

                  <button
                    type="button"
                    className="view-all"
                    onClick={() => loadDashboard(false)}
                    disabled={refreshing}
                  >
                    {refreshing ? "Memperbarui..." : "Perbarui Data"}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M5 12h14" />
                      <path d="M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>

                <div className="transaction-table-wrapper">
                  <table className="transaction-table">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Keterangan</th>
                        <th>Kategori</th>
                        <th>Jenis</th>
                        <th className="amount-column">Nominal</th>
                      </tr>
                    </thead>

                    <tbody>
                      {latestTransactions.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="dashboard-empty">
                            Belum ada transaksi kas yang dapat ditampilkan.
                          </td>
                        </tr>
                      ) : (
                        latestTransactions.map((transaction, index) => {
                          const isIncome = transaction._type === "income";
                          const isExpense = transaction._type === "expense";

                          return (
                            <tr
                              key={
                                transaction.id ||
                                transaction.uuid ||
                                `${transaction._date?.getTime()}-${index}`
                              }
                            >
                              <td>{formatDate(transaction._date)}</td>

                              <td className="transaction-name">
                                {transaction._description}
                              </td>

                              <td>
                                <span className="category-badge">
                                  {transaction.kategori ||
                                    transaction.jenis_transaksi ||
                                    transaction.jenis ||
                                    "Kas"}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={`transaction-type ${
                                    isIncome
                                      ? "income"
                                      : isExpense
                                        ? "expense"
                                        : ""
                                  }`}
                                >
                                  {isIncome
                                    ? "Pemasukan"
                                    : isExpense
                                      ? "Pengeluaran"
                                      : "Lainnya"}
                                </span>
                              </td>

                              <td
                                className={`amount ${
                                  isIncome
                                    ? "income"
                                    : isExpense
                                      ? "expense"
                                      : ""
                                }`}
                              >
                                {isIncome ? "+" : isExpense ? "-" : ""}
                                {formatRupiah(transaction._amount)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default UserDashboard;