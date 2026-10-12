
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Download,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "../../../lib/supabase";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import "../style.css";

const PERIODS = [
  { label: "1 Minggu", days: 7 },
  { label: "1 Bulan", days: 30 },
  { label: "3 Bulan", days: 90 },
  { label: "6 Bulan", days: 180 },
  { label: "1 Tahun", days: 365 },
  { label: "2 Tahun", days: 730 },
  { label: "5 Tahun", days: 1825 },
];

const SOURCES = [
  { key: "kas", label: "Jurnal Kas", table: "kas", owner: "user_id", color: "#2585ed" },
  { key: "pembelian", label: "Jurnal Pembelian", table: "pembelian", owner: "users_id", color: "#f59e0b" },
  { key: "penjualan", label: "Jurnal Penjualan", table: "penjualan", owner: "users_id", color: "#20c982" },
  { key: "utang", label: "Jurnal Utang", table: "utang", owner: "users_id", color: "#8b5cf6" },
  { key: "piutang", label: "Jurnal Piutang", table: "piutang", owner: "users_id", color: "#06b6d4" },
  { key: "inventory", label: "Inventory", table: "inventory", owner: "users_id", color: "#ec4899" },
  { key: "beban", label: "Jurnal Beban", table: "beban", owner: "users_id", color: "#ef4444" },
  { key: "users", label: "Profil Usaha", table: "users", owner: "uuid", color: "#64748b" },
];

const ACCOUNTS = [
  { code: "101", name: "Kas", normal: "Debit" },
  { code: "102", name: "Piutang Usaha", normal: "Debit" },
  { code: "103", name: "Persediaan", normal: "Debit" },
  { code: "201", name: "Utang Usaha", normal: "Kredit" },
  { code: "301", name: "Modal", normal: "Kredit" },
  { code: "401", name: "Pendapatan Penjualan", normal: "Kredit" },
  { code: "501", name: "Harga Pokok Penjualan", normal: "Debit" },
  { code: "601", name: "Beban Usaha", normal: "Debit" },
];

const AMOUNT_FIELDS = [
  "nominal",
  "total",
  "total_harga",
  "jumlah_total",
  "subtotal",
  "harga_total",
  "jumlah_bayar",
  "nilai_transaksi",
  "harga",
];

const DATE_FIELDS = [
  "tanggal",
  "tanggal_transaksi",
  "tanggal_pembelian",
  "tanggal_penjualan",
  "created_at",
];

const numberValue = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numberValue(value));

const compactMoney = (value) => {
  const n = numberValue(value);

  if (Math.abs(n) >= 1_000_000_000) {
    return `Rp${(n / 1_000_000_000).toFixed(1)} M`;
  }

  if (Math.abs(n) >= 1_000_000) {
    return `Rp${(n / 1_000_000).toFixed(1)} jt`;
  }

  if (Math.abs(n) >= 1_000) {
    return `Rp${(n / 1_000).toFixed(0)} rb`;
  }

  return `Rp${n.toLocaleString("id-ID")}`;
};

const readField = (row, fields) => {
  for (const field of fields) {
    if (
      row?.[field] !== null &&
      row?.[field] !== undefined &&
      row?.[field] !== ""
    ) {
      return row[field];
    }
  }

  return null;
};

const getDate = (row) => readField(row, DATE_FIELDS);

const getAmount = (row) => {
  const direct = readField(row, AMOUNT_FIELDS);

  if (direct !== null) {
    return Math.abs(numberValue(direct));
  }

  const quantity = numberValue(
    row?.jumlah ?? row?.qty ?? row?.kuantitas
  );

  const price = numberValue(
    row?.harga_satuan ?? row?.harga_beli ?? row?.harga
  );

  return quantity > 0 && price > 0 ? quantity * price : 0;
};

const getDescription = (row, fallback) =>
  row?.keterangan ||
  row?.deskripsi ||
  row?.nama_barang ||
  row?.nama_usaha ||
  row?.nama ||
  row?.nomor_transaksi ||
  row?.kode_transaksi ||
  fallback;

const getReference = (row, fallback) =>
  row?.nomor_transaksi ||
  row?.kode_transaksi ||
  row?.nomor_bukti ||
  (row?.id !== undefined
    ? `${fallback.toUpperCase()}-${row.id}`
    : "-");

const getCashType = (row) => {
  const type = String(
    row?.jenis || row?.jenis_transaksi || ""
  ).toLowerCase();

  if (["pemasukan", "masuk", "income", "debit"].includes(type)) {
    return "in";
  }

  if (
    ["pengeluaran", "keluar", "expense", "kredit"].includes(type)
  ) {
    return "out";
  }

  return "";
};

const formatDate = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStartDate = (days) => {
  const date = new Date();

  date.setDate(date.getDate() - days + 1);
  date.setHours(0, 0, 0, 0);

  return date;
};

const inPeriod = (row, days) => {
  const value = getDate(row);

  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return false;

  return date >= getStartDate(days) && date <= new Date();
};

const isLinkedCash = (row) =>
  [
    "pembelian_id",
    "penjualan_id",
    "utang_id",
    "piutang_id",
    "beban_id",
  ].some(
    (key) => row?.[key] !== null && row?.[key] !== undefined
  );

const sourceDebitCredit = (sourceKey, row) => {
  const amount = getAmount(row);
  const type = String(
    row?.jenis_transaksi || row?.jenis || ""
  ).toLowerCase();

  switch (sourceKey) {
    case "kas":
      if (getCashType(row) === "in") {
        return { debit: amount, credit: 0, account: "Kas" };
      }

      if (getCashType(row) === "out") {
        return { debit: 0, credit: amount, account: "Kas" };
      }

      return { debit: 0, credit: 0, account: "Kas" };

    case "penjualan":
      return {
        debit: amount,
        credit: amount,
        account: "Penjualan",
      };

    case "pembelian":
      return {
        debit: amount,
        credit: amount,
        account: "Pembelian",
      };

    case "utang":
      return {
        debit: amount,
        credit: amount,
        account: type === "debit" ? "Pembayaran utang" : "Utang",
      };

    case "piutang":
      return {
        debit: amount,
        credit: amount,
        account: type === "kredit" ? "Penerimaan piutang" : "Piutang",
      };

    case "beban":
      return {
        debit: amount,
        credit: amount,
        account: "Beban",
      };

    case "inventory":
      return {
        debit: amount,
        credit: 0,
        account: "Persediaan",
      };

    default:
      return { debit: 0, credit: 0, account: sourceKey };
  }
};

const createLedgerRows = (datasets, days) => {
  const rows = [];

  SOURCES.filter((source) => source.key !== "users").forEach(
    (source) => {
      (datasets[source.key] || [])
        .filter((row) => inPeriod(row, days))
        .forEach((row) => {
          if (source.key === "kas" && isLinkedCash(row)) {
            return;
          }

          const amount = getAmount(row);
          const entry = sourceDebitCredit(source.key, row);

          if (!amount && !getDate(row)) return;

          rows.push({
            id: `${source.key}-${row.id ?? rows.length}`,
            date: getDate(row),
            reference: getReference(row, source.key),
            source: source.label,
            description: getDescription(row, source.label),
            debit: entry.debit,
            credit: entry.credit,
            account: entry.account,
            amount,
            sourceKey: source.key,
          });
        });
    }
  );

  return rows.sort(
    (a, b) => new Date(a.date || 0) - new Date(b.date || 0)
  );
};

const buildChartData = (cashRows, days) => {
  const now = new Date();
  const buckets = new Map();

  const useDaily = days <= 30;
  const useWeekly = days > 30 && days <= 180;

  const keyFor = (date) => {
    const d = new Date(date);

    if (useDaily) {
      return `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    if (useWeekly) {
      const day = d.getDay();
      d.setDate(d.getDate() - day);

      return `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    return `${d.getFullYear()}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}`;
  };

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);

    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const key = keyFor(date);

    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        pemasukan: 0,
        pengeluaran: 0,
        date,
      });
    }
  }

  cashRows.forEach((row) => {
    const dateValue = getDate(row);

    if (!dateValue || !inPeriod(row, days)) return;

    const key = keyFor(dateValue);

    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        pemasukan: 0,
        pengeluaran: 0,
        date: new Date(dateValue),
      });
    }

    const bucket = buckets.get(key);
    const amount = getAmount(row);
    const type = getCashType(row);

    if (type === "in") bucket.pemasukan += amount;
    if (type === "out") bucket.pengeluaran += amount;
  });

  return [...buckets.values()]
    .sort((a, b) => a.date - b.date)
    .map((item) => ({
      ...item,
      label: useDaily
        ? item.date.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
          })
        : useWeekly
          ? item.date.toLocaleDateString("id-ID", {
              day: "2-digit",
              month: "short",
            })
          : item.date.toLocaleDateString("id-ID", {
              month: "short",
              year: "2-digit",
            }),
    }));
};

const downloadCSV = (rows) => {
  const headers = [
    "Tanggal",
    "Nomor Transaksi",
    "Sumber",
    "Keterangan",
    "Akun",
    "Debit",
    "Kredit",
  ];

  const data = rows.map((row) => [
    row.date || "",
    row.reference,
    row.source,
    row.description,
    row.account,
    row.debit,
    row.credit,
  ]);

  const csv = [headers, ...data]
    .map((line) =>
      line
        .map(
          (value) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
        )
        .join(";")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = "buku-besar-sicounting.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
};

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone,
  compact = false,
}) {
  return (
    <article className={`bb-stat-card bb-tone-${tone}`}>
      <div className="bb-stat-top">
        <span className="bb-stat-icon">
          <Icon size={19} />
        </span>

        <span className="bb-stat-title">{title}</span>
      </div>

      <strong
        className={
          compact
            ? "bb-stat-value bb-value-small"
            : "bb-stat-value"
        }
      >
        {value}
      </strong>

      <span className="bb-stat-subtitle">{subtitle}</span>
    </article>
  );
}

function EmptyState({ children }) {
  return (
    <div className="bb-empty">
      <BookOpen size={28} />
      <span>{children}</span>
    </div>
  );
}

export default function Bukubesar() {
  const [period, setPeriod] = useState(30);
  const [datasets, setDatasets] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("semua");
  const [accountFilter, setAccountFilter] = useState("semua");

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;

      const user = authData?.user;

      if (!user) {
        throw new Error("Silakan login terlebih dahulu.");
      }

      const results = await Promise.all(
        SOURCES.map(async (source) => {
          const { data, error: queryError } = await supabase
            .from(source.table)
            .select("*")
            .eq(source.owner, user.id);

          if (queryError) {
            return {
              key: source.key,
              data: [],
              error: queryError.message,
            };
          }

          return {
            key: source.key,
            data: data || [],
            error: "",
          };
        })
      );

      const nextData = {};
      const failed = [];

      results.forEach((result) => {
        nextData[result.key] = result.data;

        if (result.error) {
          failed.push(`${result.key}: ${result.error}`);
        }
      });

      setDatasets(nextData);

      if (failed.length > 0) {
        setError(
          `Sebagian data belum dapat dibaca: ${failed.join(
            " | "
          )}. Periksa nama tabel, kolom pemilik, dan kebijakan RLS Supabase.`
        );
      }
    } catch (err) {
      setError(
        err?.message || "Gagal mengambil data Buku Besar."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredByPeriod = useMemo(() => {
    const result = {};

    SOURCES.forEach((source) => {
      result[source.key] = (datasets[source.key] || []).filter(
        (row) => inPeriod(row, period)
      );
    });

    return result;
  }, [datasets, period]);

  const stats = useMemo(() => {
    const cash = filteredByPeriod.kas || [];

    const income = cash
      .filter((row) => getCashType(row) === "in")
      .reduce((sum, row) => sum + getAmount(row), 0);

    const expense = cash
      .filter((row) => getCashType(row) === "out")
      .reduce((sum, row) => sum + getAmount(row), 0);

    const sumSource = (key) =>
      (filteredByPeriod[key] || []).reduce(
        (sum, row) => sum + getAmount(row),
        0
      );

    return {
      income,
      expense,
      net: income - expense,
      cashCount: cash.length,
      purchase: sumSource("pembelian"),
      sales: sumSource("penjualan"),
      debt: sumSource("utang"),
      receivable: sumSource("piutang"),
      inventory: sumSource("inventory"),
      burden: sumSource("beban"),
      transactionCount: Object.entries(filteredByPeriod)
        .filter(([key]) => key !== "users")
        .reduce((sum, [, rows]) => sum + rows.length, 0),
    };
  }, [filteredByPeriod]);

  const chartData = useMemo(
    () => buildChartData(datasets.kas || [], period),
    [datasets.kas, period]
  );

  const sourceStats = useMemo(
    () =>
      SOURCES.map((source) => {
        const rows = filteredByPeriod[source.key] || [];

        return {
          ...source,
          count: rows.length,
          total: rows.reduce(
            (sum, row) => sum + getAmount(row),
            0
          ),
        };
      }),
    [filteredByPeriod]
  );

  const ledger = useMemo(
    () => createLedgerRows(datasets, period),
    [datasets, period]
  );

  const filteredLedger = useMemo(() => {
    const query = search.trim().toLowerCase();

    return ledger.filter((row) => {
      const matchesSearch =
        !query ||
        [
          row.reference,
          row.source,
          row.description,
          row.account,
          row.date,
        ].some((value) =>
          String(value || "").toLowerCase().includes(query)
        );

      const matchesSource =
        sourceFilter === "semua" ||
        row.sourceKey === sourceFilter;

      const matchesAccount =
        accountFilter === "semua" ||
        row.account === accountFilter;

      return matchesSearch && matchesSource && matchesAccount;
    });
  }, [ledger, search, sourceFilter, accountFilter]);

  const ledgerTotals = useMemo(
    () =>
      filteredLedger.reduce(
        (total, row) => ({
          debit: total.debit + row.debit,
          credit: total.credit + row.credit,
        }),
        { debit: 0, credit: 0 }
      ),
    [filteredLedger]
  );

  const accountStats = useMemo(
    () =>
      ACCOUNTS.map((account) => {
        const related = ledger.filter(
          (row) => row.account === account.name
        );

        const debit = related.reduce(
          (sum, row) => sum + row.debit,
          0
        );

        const credit = related.reduce(
          (sum, row) => sum + row.credit,
          0
        );

        const ending =
          account.normal === "Debit"
            ? debit - credit
            : credit - debit;

        return {
          ...account,
          debit,
          credit,
          ending,
        };
      }),
    [ledger]
  );

  const pieData = useMemo(() => {
    const values = [
      {
        name: "Penjualan",
        value: stats.sales,
        color: "#20c982",
      },
      {
        name: "Pembelian",
        value: stats.purchase,
        color: "#f59e0b",
      },
      {
        name: "Beban",
        value: stats.burden,
        color: "#ef4444",
      },
      {
        name: "Inventory",
        value: stats.inventory,
        color: "#ec4899",
      },
    ].filter((item) => item.value > 0);

    return values.length
      ? values
      : [
          {
            name: "Belum ada data",
            value: 1,
            color: "#dfe5ec",
          },
        ];
  }, [stats]);

  const selectedPeriod =
    PERIODS.find((item) => item.days === period)?.label ||
    "1 Bulan";

  return (
    <div className="dashboard-layout bb-dashboard-layout">
      <Sidebar />

      <div className="dashboard-main bb-dashboard-main">
        <Header />

        <main className="bb-page">
          <header className="bb-page-header">
            <div>
              <div className="bb-eyebrow">
                <BookOpen size={15} />
                LAPORAN KEUANGAN
              </div>

              <h1>Buku Besar</h1>

              <p>
                Rekapitulasi transaksi dan pergerakan keuangan
                usaha dalam satu halaman.
              </p>
            </div>

            <div className="bb-header-actions">
              <span className="bb-live-status">
                <span />
                Data Supabase
              </span>

              <button
                type="button"
                className="bb-button bb-button-primary"
                onClick={() => downloadCSV(filteredLedger)}
                disabled={!filteredLedger.length}
              >
                <Download size={17} />
                Ekspor CSV
              </button>
            </div>
          </header>

          {error && (
            <div className="bb-alert" role="alert">
              <Activity size={18} />

              <div>
                <strong>Perlu pemeriksaan data</strong>
                <span>{error}</span>
              </div>

              <button
                type="button"
                onClick={() => loadData(true)}
                aria-label="Coba lagi"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          )}

          <section className="bb-filter-panel">
            <div className="bb-filter-label">
              <CalendarDays size={18} />

              <div>
                <strong>Periode laporan</strong>
                <span>
                  Pilih rentang waktu yang ingin dianalisis
                </span>
              </div>
            </div>

            <div className="bb-periods">
              {PERIODS.map((item) => (
                <button
                  type="button"
                  key={item.days}
                  className={
                    period === item.days
                      ? "bb-period active"
                      : "bb-period"
                  }
                  onClick={() => setPeriod(item.days)}
                  aria-pressed={period === item.days}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="bb-button bb-button-quiet"
              onClick={() => loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={refreshing ? "bb-spin" : ""}
              />
              {refreshing ? "Memuat..." : "Segarkan"}
            </button>
          </section>

          <div className="bb-period-caption">
            <Clock3 size={14} />

            <span>
              Menampilkan data {selectedPeriod.toLowerCase()} terakhir
              hingga hari ini.
            </span>

            {loading && (
              <span className="bb-loading-text">
                Memuat data...
              </span>
            )}
          </div>

          <section className="bb-stats-grid">
            <StatCard
              title="Pemasukan Kas"
              value={money(stats.income)}
              subtitle="Total kas masuk"
              icon={ArrowDownLeft}
              tone="green"
            />

            <StatCard
              title="Pengeluaran Kas"
              value={money(stats.expense)}
              subtitle="Total kas keluar"
              icon={ArrowUpRight}
              tone="red"
            />

            <StatCard
              title="Selisih Arus Kas"
              value={money(stats.net)}
              subtitle="Kas masuk dikurangi kas keluar"
              icon={Wallet}
              tone="blue"
            />

            <StatCard
              title="Total Transaksi"
              value={stats.transactionCount.toLocaleString("id-ID")}
              subtitle="Akumulasi seluruh sumber data"
              icon={Activity}
              tone="purple"
            />
          </section>

          <section className="bb-charts-grid">
            <article className="bb-panel bb-main-chart">
              <div className="bb-panel-header">
                <div>
                  <h2>Tren Arus Kas</h2>
                  <p>
                    Pemasukan dan pengeluaran berdasarkan jurnal kas
                  </p>
                </div>

                <span className="bb-panel-icon">
                  <TrendingUp size={18} />
                </span>
              </div>

              <div className="bb-chart-area">
                {loading ? (
                  <EmptyState>Memuat grafik...</EmptyState>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={chartData}
                      margin={{
                        top: 12,
                        right: 8,
                        left: 4,
                        bottom: 0,
                      }}
                    >
                      <defs>
                        <linearGradient
                          id="bbIncomeGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#20c982"
                            stopOpacity={0.22}
                          />
                          <stop
                            offset="95%"
                            stopColor="#20c982"
                            stopOpacity={0}
                          />
                        </linearGradient>

                        <linearGradient
                          id="bbExpenseGradient"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#ef4444"
                            stopOpacity={0.15}
                          />
                          <stop
                            offset="95%"
                            stopColor="#ef4444"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>

                      <CartesianGrid
                        stroke="#edf1f5"
                        strokeDasharray="4 4"
                        vertical={false}
                      />

                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#7b8794", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        minTickGap={18}
                      />

                      <YAxis
                        tickFormatter={compactMoney}
                        tick={{ fill: "#7b8794", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={68}
                      />

                      <Tooltip
                        formatter={(value, name) => [
                          money(value),
                          name === "pemasukan"
                            ? "Pemasukan"
                            : "Pengeluaran",
                        ]}
                        labelStyle={{
                          color: "#1d2939",
                          fontWeight: 700,
                        }}
                        contentStyle={{
                          borderRadius: 12,
                          border: "1px solid #e8edf2",
                          boxShadow: "0 8px 24px #15223812",
                        }}
                      />

                      <Legend
                        formatter={(value) =>
                          value === "pemasukan"
                            ? "Pemasukan"
                            : "Pengeluaran"
                        }
                      />

                      <Area
                        type="monotone"
                        dataKey="pemasukan"
                        stroke="#20c982"
                        strokeWidth={2.5}
                        fill="url(#bbIncomeGradient)"
                      />

                      <Area
                        type="monotone"
                        dataKey="pengeluaran"
                        stroke="#ef4444"
                        strokeWidth={2.5}
                        fill="url(#bbExpenseGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </article>

            <article className="bb-panel bb-composition-chart">
              <div className="bb-panel-header">
                <div>
                  <h2>Komposisi Data</h2>
                  <p>Perbandingan nilai dari jurnal usaha</p>
                </div>

                <span className="bb-panel-icon">
                  <CircleDollarSign size={18} />
                </span>
              </div>

              <div className="bb-pie-area">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={62}
                      outerRadius={91}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {pieData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.color}
                        />
                      ))}
                    </Pie>

                    <Tooltip
                      formatter={(value) => money(value)}
                    />

                    <Legend
                      verticalAlign="bottom"
                      height={34}
                      iconType="circle"
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="bb-chart-note">
                Nilai diambil dari kolom nominal yang dikenali pada
                setiap tabel. Cocokkan kembali dengan struktur database.
              </div>
            </article>
          </section>

          <section className="bb-panel bb-source-panel">
            <div className="bb-panel-header">
              <div>
                <h2>Statistik 8 Tabel</h2>
                <p>
                  Aktivitas masing-masing sumber data pada periode
                  terpilih
                </p>
              </div>

              <span className="bb-panel-icon">
                <Boxes size={18} />
              </span>
            </div>

            <div className="bb-source-grid">
              {sourceStats.map((item) => (
                <article
                  className="bb-source-card"
                  key={item.key}
                >
                  <div className="bb-source-top">
                    <span
                      className="bb-source-dot"
                      style={{ background: item.color }}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.key === "users" ? (
                    <>
                      <strong>
                        {item.count.toLocaleString("id-ID")}
                      </strong>
                      <small>Profil usaha milik akun ini</small>
                    </>
                  ) : (
                    <>
                      <strong>
                        {item.count.toLocaleString("id-ID")}{" "}
                        <small>transaksi</small>
                      </strong>
                      <span className="bb-source-total">
                        {money(item.total)}
                      </span>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="bb-secondary-stats">
            <article className="bb-panel bb-secondary-panel">
              <div className="bb-panel-header">
                <div>
                  <h2>Ringkasan Aktivitas</h2>
                  <p>Nilai berdasarkan jurnal terkait</p>
                </div>

                <span className="bb-panel-icon">
                  <ShoppingCart size={18} />
                </span>
              </div>

              <div className="bb-metric-row">
                <span>
                  <span className="bb-metric-dot green" />
                  Penjualan
                </span>
                <strong>{money(stats.sales)}</strong>
              </div>

              <div className="bb-metric-row">
                <span>
                  <span className="bb-metric-dot amber" />
                  Pembelian
                </span>
                <strong>{money(stats.purchase)}</strong>
              </div>

              <div className="bb-metric-row">
                <span>
                  <span className="bb-metric-dot red" />
                  Beban usaha
                </span>
                <strong>{money(stats.burden)}</strong>
              </div>

              <div className="bb-metric-row">
                <span>
                  <span className="bb-metric-dot pink" />
                  Nilai inventory
                </span>
                <strong>{money(stats.inventory)}</strong>
              </div>
            </article>

            <article className="bb-panel bb-secondary-panel">
              <div className="bb-panel-header">
                <div>
                  <h2>Posisi Utang &amp; Piutang</h2>
                  <p>Nilai transaksi dalam periode terpilih</p>
                </div>

                <span className="bb-panel-icon">
                  <FileSpreadsheet size={18} />
                </span>
              </div>

              <div className="bb-position-card">
                <div className="bb-position-icon purple">
                  <ArrowUpRight size={18} />
                </div>

                <div>
                  <span>Aktivitas jurnal utang</span>
                  <strong>{money(stats.debt)}</strong>
                </div>
              </div>

              <div className="bb-position-card">
                <div className="bb-position-icon cyan">
                  <ArrowDownLeft size={18} />
                </div>

                <div>
                  <span>Aktivitas jurnal piutang</span>
                  <strong>{money(stats.receivable)}</strong>
                </div>
              </div>

              <p className="bb-note">
                Ini total nominal transaksi, bukan otomatis saldo
                utang atau piutang yang masih tersisa.
              </p>
            </article>
          </section>

          <section className="bb-panel bb-account-panel">
            <div className="bb-panel-header">
              <div>
                <h2>Ringkasan Buku Besar per Akun</h2>
                <p>Rekap debit dan kredit dari pemetaan awal</p>
              </div>

              <span className="bb-panel-icon">
                <BookOpen size={18} />
              </span>
            </div>

            <div className="bb-table-wrap">
              <table className="bb-table">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama Akun</th>
                    <th>Saldo Normal</th>
                    <th className="number">Debit</th>
                    <th className="number">Kredit</th>
                    <th className="number">Saldo Mutasi</th>
                  </tr>
                </thead>

                <tbody>
                  {accountStats.map((account) => (
                    <tr key={account.code}>
                      <td>
                        <span className="bb-account-code">
                          {account.code}
                        </span>
                      </td>

                      <td className="bb-account-name">
                        {account.name}
                      </td>

                      <td>
                        <span
                          className={`bb-normal-badge ${account.normal.toLowerCase()}`}
                        >
                          {account.normal}
                        </span>
                      </td>

                      <td className="number">
                        {money(account.debit)}
                      </td>

                      <td className="number">
                        {money(account.credit)}
                      </td>

                      <td className="number bb-ending-balance">
                        {money(account.ending)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bb-note bb-account-note">
              Saldo awal belum dimasukkan, dan pemetaan debit/kredit
              masih perlu disesuaikan dengan kolom serta aturan
              transaksi Sicounting. Jangan gunakan rekap ini sebagai
              laporan akuntansi final sebelum validasi.
            </div>
          </section>

          <section className="bb-panel bb-ledger-panel">
            <div className="bb-panel-header bb-ledger-heading">
              <div>
                <h2>Rincian Mutasi</h2>
                <p>
                  Telusuri transaksi dari berbagai sumber dalam
                  periode terpilih
                </p>
              </div>

              <span className="bb-result-count">
                {filteredLedger.length.toLocaleString("id-ID")} baris
              </span>
            </div>

            <div className="bb-ledger-filters">
              <label className="bb-search">
                <Search size={17} />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari nomor, keterangan, atau akun..."
                />

                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Hapus pencarian"
                  >
                    <X size={15} />
                  </button>
                )}
              </label>

              <label className="bb-select-wrap">
                <Filter size={16} />

                <select
                  value={sourceFilter}
                  onChange={(event) =>
                    setSourceFilter(event.target.value)
                  }
                >
                  <option value="semua">Semua sumber</option>

                  {SOURCES.filter(
                    (source) => source.key !== "users"
                  ).map((source) => (
                    <option
                      key={source.key}
                      value={source.key}
                    >
                      {source.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="bb-select-wrap">
                <BookOpen size={16} />

                <select
                  value={accountFilter}
                  onChange={(event) =>
                    setAccountFilter(event.target.value)
                  }
                >
                  <option value="semua">Semua akun</option>

                  {[...new Set(ledger.map((row) => row.account))].map(
                    (account) => (
                      <option key={account} value={account}>
                        {account}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div className="bb-table-wrap">
              <table className="bb-table bb-ledger-table">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>No. Transaksi</th>
                    <th>Sumber</th>
                    <th>Keterangan</th>
                    <th>Akun</th>
                    <th className="number">Debit</th>
                    <th className="number">Kredit</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState>
                          Memuat data transaksi...
                        </EmptyState>
                      </td>
                    </tr>
                  ) : filteredLedger.length ? (
                    filteredLedger.map((row) => (
                      <tr key={row.id}>
                        <td className="bb-date">
                          {formatDate(row.date)}
                        </td>

                        <td>
                          <span className="bb-reference">
                            {row.reference}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`bb-source-badge source-${row.sourceKey}`}
                          >
                            {row.source}
                          </span>
                        </td>

                        <td className="bb-description">
                          {row.description}
                        </td>

                        <td>{row.account}</td>

                        <td className="number">
                          {row.debit ? money(row.debit) : "—"}
                        </td>

                        <td className="number">
                          {row.credit ? money(row.credit) : "—"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState>
                          Tidak ada transaksi untuk filter ini.
                        </EmptyState>
                      </td>
                    </tr>
                  )}
                </tbody>

                {!loading && filteredLedger.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={5}>
                        Total mutasi yang ditampilkan
                      </td>

                      <td className="number">
                        {money(ledgerTotals.debit)}
                      </td>

                      <td className="number">
                        {money(ledgerTotals.credit)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          <footer className="bb-footer-note">
            <CheckCircle2 size={16} />

            <span>
              <strong>Perhatian:</strong> grafik arus kas bersumber
              dari jurnal kas. Total nominal lintas tabel tidak
              dijumlahkan menjadi satu saldo karena satu transaksi
              dapat tercatat di beberapa jurnal.
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
