
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "datatables.net-react";
import DtCore from "datatables.net-dt";
import JSZip from "jszip";

import "datatables.net-dt/css";
import "datatables.net-buttons-dt";
import "datatables.net-buttons/js/buttons.html5.mjs";

import { supabase } from "../../../lib/supabase";
import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";

import {
  getUtang,
  createUtang,
} from "../../service/utangService";

import "../style.css";

DataTable.use(DtCore);
DtCore.Buttons.jszip(JSZip);

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatTanggal = (value) => {
  if (!value) return "-";

  const tanggal = new Date(`${value}T00:00:00`);

  if (Number.isNaN(tanggal.getTime())) return "-";

  return tanggal.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const tanggalHariIni = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;

  return new Date(now.getTime() - offset)
    .toISOString()
    .slice(0, 10);
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return characters[character];
  });

const formAwal = {
  tanggal: tanggalHariIni(),
  jenis_transaksi: "kredit",
  nominal: "",
  keterangan: "",
};

function Utang() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filterJenis, setFilterJenis] = useState("semua");
  const [filterTanggal, setFilterTanggal] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(formAwal);

  const [pageLength, setPageLength] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 768
      ? 10
      : 20
  );

  useEffect(() => {
    const handleResize = () => {
      setPageLength(window.innerWidth <= 768 ? 10 : 20);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getUtang();
      setData(result || []);
    } catch (err) {
      setError(err.message || "Gagal mengambil data utang.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dataTerfilter = useMemo(() => {
    return data.filter((item) => {
      const cocokJenis =
        filterJenis === "semua" ||
        item.jenis_transaksi === filterJenis;

      const cocokTanggal =
        !filterTanggal || item.tanggal === filterTanggal;

      return cocokJenis && cocokTanggal;
    });
  }, [data, filterJenis, filterTanggal]);

  const ringkasan = useMemo(() => {
    const totalPenambahan = data
      .filter((item) => item.jenis_transaksi === "kredit")
      .reduce(
        (total, item) => total + (Number(item.nominal) || 0),
        0
      );

    const totalPembayaran = data
      .filter((item) => item.jenis_transaksi === "debit")
      .reduce(
        (total, item) => total + (Number(item.nominal) || 0),
        0
      );

    return {
      totalPenambahan,
      totalPembayaran,
      totalUtang: totalPenambahan - totalPembayaran,
    };
  }, [data]);

  const bukaTambah = () => {
    setForm({
      ...formAwal,
      tanggal: tanggalHariIni(),
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const tutupModal = () => {
    if (saving) return;

    setModalOpen(false);
    setForm({
      ...formAwal,
      tanggal: tanggalHariIni(),
    });
    setError("");
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const nominal = Number(form.nominal);

    if (!form.tanggal) {
      setError("Tanggal transaksi wajib diisi.");
      return;
    }

    if (!Number.isFinite(nominal) || nominal <= 0) {
      setError("Nominal harus lebih besar dari nol.");
      return;
    }

    if (!["kredit", "debit"].includes(form.jenis_transaksi)) {
      setError("Jenis transaksi tidak valid.");
      return;
    }

    if (!form.keterangan.trim()) {
      setError("Keterangan transaksi wajib diisi.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        throw new Error("Silakan login terlebih dahulu.");
      }

      const payload = {
        users_id: user.id,
        tanggal: form.tanggal,
        jenis_transaksi: form.jenis_transaksi,
        nominal,
        keterangan: form.keterangan.trim(),
      };

      await createUtang(payload);

      setModalOpen(false);
      setForm({
        ...formAwal,
        tanggal: tanggalHariIni(),
      });

      setSuccess(
        form.jenis_transaksi === "debit"
          ? "Pembayaran utang berhasil dicatat dan pengeluaran kas diperbarui."
          : "Penambahan utang berhasil dicatat."
      );

      await loadData();
    } catch (err) {
      setError(
        err.message || "Gagal menyimpan transaksi utang."
      );
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo(
    () => [
      {
        data: "tanggal",
        title: "Tanggal",
        render: (value, type) =>
          type === "display"
            ? formatTanggal(value)
            : value || "",
      },
      {
        data: "jenis_transaksi",
        title: "Jenis Transaksi",
        render: (value, type) => {
          if (type !== "display") return value || "";

          if (value === "kredit") {
            return '<span class="utang-badge utang-badge-kredit">Penambahan</span>';
          }

          if (value === "debit") {
            return '<span class="utang-badge utang-badge-debit">Pembayaran</span>';
          }

          return "-";
        },
      },
      {
        data: "keterangan",
        title: "Keterangan",
        defaultContent: "-",
        render: (value, type) =>
          type === "display"
            ? escapeHtml(value || "-")
            : value || "",
      },
      {
        data: "nominal",
        title: "Nominal",
        className: "utang-nominal",
        render: (value, type) =>
          type === "display"
            ? formatRupiah(value)
            : Number(value) || 0,
      },
    ],
    []
  );

  const options = useMemo(
    () => ({
      pageLength,
      lengthChange: false,
      searching: true,
      ordering: true,
      order: [[0, "desc"]],
      scrollX: true,
      autoWidth: false,
      layout: {
        topStart: {
          buttons: [
            {
              extend: "excelHtml5",
              text: "Ekspor Excel",
              title: "Laporan Jurnal Utang",
              filename: "laporan-jurnal-utang",
              exportOptions: {
                columns: [0, 1, 2, 3],
              },
            },
          ],
        },
        topEnd: "search",
        bottomStart: "info",
        bottomEnd: "paging",
      },
      language: {
        search: "Cari:",
        searchPlaceholder: "Cari transaksi utang...",
        info: "Menampilkan _START_–_END_ dari _TOTAL_ data",
        infoEmpty: "Belum ada data",
        zeroRecords: "Data tidak ditemukan",
        emptyTable: "Belum ada transaksi utang",
        infoFiltered: "(disaring dari _MAX_ transaksi)",
        paginate: {
          first: "Pertama",
          last: "Terakhir",
          next: "Berikutnya",
          previous: "Sebelumnya",
        },
      },
    }),
    [pageLength]
  );

  return (
    <div className="dashboard-page">
      <Sidebar />

      <div className="dashboard-main">
        <Header />

        <main className="dashboard-content">
          <section className="utang-page">
            <div className="utang-header">
              <div>
                <h1>Jurnal Utang</h1>
                <p>
                  Kelola penambahan utang dan pembayaran utang usaha.
                </p>
              </div>

              <button
                type="button"
                className="utang-primary-button"
                onClick={bukaTambah}
              >
                + Tambah Transaksi
              </button>
            </div>

            {error && !modalOpen && (
              <div
                className="utang-alert utang-alert-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="utang-alert utang-alert-success"
                role="status"
              >
                {success}
              </div>
            )}

            <div className="utang-summary">
              <div className="utang-summary-card">
                <span>Total Utang Bersih</span>
                <strong>
                  {formatRupiah(ringkasan.totalUtang)}
                </strong>
                <small>Penambahan dikurangi pembayaran</small>
              </div>

              <div className="utang-summary-card">
                <span>Total Penambahan</span>
                <strong>
                  {formatRupiah(ringkasan.totalPenambahan)}
                </strong>
                <small>Seluruh transaksi kredit</small>
              </div>

              <div className="utang-summary-card">
                <span>Total Pembayaran</span>
                <strong>
                  {formatRupiah(ringkasan.totalPembayaran)}
                </strong>
                <small>Seluruh transaksi debit</small>
              </div>
            </div>

            <div className="utang-filter">
              <div className="utang-filter-item">
                <label htmlFor="filter-jenis-utang">
                  Jenis transaksi
                </label>

                <select
                  id="filter-jenis-utang"
                  value={filterJenis}
                  onChange={(event) =>
                    setFilterJenis(event.target.value)
                  }
                >
                  <option value="semua">Semua jenis</option>
                  <option value="kredit">Penambahan utang</option>
                  <option value="debit">Pembayaran utang</option>
                </select>
              </div>

              <div className="utang-filter-item">
                <label htmlFor="filter-tanggal-utang">
                  Tanggal
                </label>

                <input
                  id="filter-tanggal-utang"
                  type="date"
                  value={filterTanggal}
                  onChange={(event) =>
                    setFilterTanggal(event.target.value)
                  }
                />
              </div>

              <button
                type="button"
                className="utang-reset-button"
                onClick={() => {
                  setFilterJenis("semua");
                  setFilterTanggal("");
                }}
              >
                Reset Filter
              </button>
            </div>

            <div className="utang-table-card">
              <div className="utang-table-heading">
                <div>
                  <h2>Daftar Transaksi</h2>
                  <p>Data transaksi utang usaha.</p>
                </div>

                <span className="utang-total-data">
                  {dataTerfilter.length} transaksi
                </span>
              </div>

              {loading ? (
                <div className="utang-empty">
                  Memuat data transaksi...
                </div>
              ) : (
                <div className="utang-table-wrapper">
                  <DataTable
                    key={pageLength}
                    data={dataTerfilter}
                    columns={columns}
                    options={options}
                    className="display utang-data-table"
                  />
                </div>
              )}
            </div>

            {modalOpen && (
              <div
                className="utang-modal-overlay"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    tutupModal();
                  }
                }}
              >
                <div
                  className="utang-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="utang-modal-title"
                >
                  <div className="utang-modal-header">
                    <div>
                      <h2 id="utang-modal-title">
                        Tambah Transaksi
                      </h2>
                      <p>
                        Lengkapi informasi transaksi utang.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="utang-modal-close"
                      onClick={tutupModal}
                      disabled={saving}
                      aria-label="Tutup formulir"
                    >
                      ×
                    </button>
                  </div>

                  {error && (
                    <div
                      className="utang-alert utang-alert-error"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}

                  <form
                    onSubmit={handleSubmit}
                    className="utang-form"
                  >
                    <div className="utang-form-group">
                      <label htmlFor="utang-tanggal">
                        Tanggal transaksi
                      </label>

                      <input
                        id="utang-tanggal"
                        type="date"
                        name="tanggal"
                        value={form.tanggal}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="utang-form-group">
                      <label htmlFor="utang-jenis">
                        Jenis transaksi
                      </label>

                      <select
                        id="utang-jenis"
                        name="jenis_transaksi"
                        value={form.jenis_transaksi}
                        onChange={handleChange}
                        required
                      >
                        <option value="kredit">
                          Kredit — menambah utang
                        </option>
                        <option value="debit">
                          Debit — membayar utang
                        </option>
                      </select>
                    </div>

                    <div className="utang-form-group">
                      <label htmlFor="utang-nominal">
                        Nominal (Rp)
                      </label>

                      <input
                        id="utang-nominal"
                        type="number"
                        name="nominal"
                        min="1"
                        step="1"
                        placeholder="Contoh: 500000"
                        value={form.nominal}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="utang-form-group">
                      <label htmlFor="utang-keterangan">
                        Keterangan
                      </label>

                      <textarea
                        id="utang-keterangan"
                        name="keterangan"
                        rows="3"
                        maxLength={1000}
                        placeholder="Contoh: Pembayaran utang kepada pemasok"
                        value={form.keterangan}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    {form.jenis_transaksi === "debit" && (
                      <p>
                        Pembayaran ini akan dicatat sebagai
                        pengeluaran pada Jurnal Kas.
                      </p>
                    )}

                    <div className="utang-form-actions">
                      <button
                        type="button"
                        className="utang-secondary-button"
                        onClick={tutupModal}
                        disabled={saving}
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        className="utang-primary-button"
                        disabled={saving}
                      >
                        {saving
                          ? "Menyimpan..."
                          : "Simpan Transaksi"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default Utang;
