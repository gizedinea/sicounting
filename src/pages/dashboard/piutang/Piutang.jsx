
import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "datatables.net-react";
import DtCore from "datatables.net-dt";
import JSZip from "jszip";

import "datatables.net-dt/css";
import "datatables.net-buttons-dt";
import "datatables.net-buttons/js/buttons.html5.mjs";

import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";

import {
  getPiutang,
  createPiutang,
} from "../../service/piutangService";

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
  jenis_transaksi: "debit",
  nominal: "",
  keterangan: "",
};

function Piutang() {
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
      const result = await getPiutang();
      setData(result || []);
    } catch (err) {
      setError(err.message || "Gagal mengambil data piutang.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dataTerfilter = useMemo(
    () =>
      data.filter((item) => {
        const cocokJenis =
          filterJenis === "semua" ||
          item.jenis_transaksi === filterJenis;

        const cocokTanggal =
          !filterTanggal || item.tanggal === filterTanggal;

        return cocokJenis && cocokTanggal;
      }),
    [data, filterJenis, filterTanggal]
  );

  const totalPenambahan = useMemo(
    () =>
      data
        .filter((item) => item.jenis_transaksi === "debit")
        .reduce(
          (total, item) => total + (Number(item.nominal) || 0),
          0
        ),
    [data]
  );

  const totalPenerimaan = useMemo(
    () =>
      data
        .filter((item) => item.jenis_transaksi === "kredit")
        .reduce(
          (total, item) => total + (Number(item.nominal) || 0),
          0
        ),
    [data]
  );

  const totalPiutang = totalPenambahan - totalPenerimaan;

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

    setForm((prev) => ({
      ...prev,
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

    if (!["debit", "kredit"].includes(form.jenis_transaksi)) {
      setError("Jenis transaksi tidak valid.");
      return;
    }

    if (!Number.isFinite(nominal) || nominal <= 0) {
      setError("Nominal harus lebih besar dari nol.");
      return;
    }

    if (!form.keterangan.trim()) {
      setError("Keterangan transaksi wajib diisi.");
      return;
    }

    setSaving(true);

    try {
      await createPiutang({
        tanggal: form.tanggal,
        jenis_transaksi: form.jenis_transaksi,
        nominal,
        keterangan: form.keterangan.trim(),
      });

      setModalOpen(false);
      setForm({
        ...formAwal,
        tanggal: tanggalHariIni(),
      });

      setSuccess(
        form.jenis_transaksi === "kredit"
          ? "Pembayaran piutang berhasil dicatat dan kas bertambah."
          : "Penambahan piutang berhasil dicatat."
      );

      await loadData();
    } catch (err) {
      setError(err.message || "Gagal menyimpan transaksi piutang.");
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
          type === "display" ? formatTanggal(value) : value || "",
      },
      {
        data: "jenis_transaksi",
        title: "Jenis Transaksi",
        render: (value, type) => {
          if (type !== "display") return value || "";

          if (value === "debit") {
            return (
              '<span class="piutang-badge piutang-badge-debit">' +
              "Penambahan</span>"
            );
          }

          if (value === "kredit") {
            return (
              '<span class="piutang-badge piutang-badge-kredit">' +
              "Penerimaan</span>"
            );
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
        className: "piutang-nominal",
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
              title: "Laporan Jurnal Piutang",
              filename: "laporan-jurnal-piutang",
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
        searchPlaceholder: "Cari transaksi piutang...",
        info: "Menampilkan _START_–_END_ dari _TOTAL_ data",
        infoEmpty: "Belum ada data",
        zeroRecords: "Data tidak ditemukan",
        emptyTable: "Belum ada transaksi piutang",
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
          <section className="piutang-page">
            <div className="piutang-header">
              <div>
                <h1>Jurnal Piutang</h1>
                <p>
                  Kelola piutang pelanggan dan penerimaan pembayaran.
                </p>
              </div>

              <button
                type="button"
                className="piutang-primary-button"
                onClick={bukaTambah}
              >
                + Tambah Transaksi
              </button>
            </div>

            {error && !modalOpen && (
              <div
                className="piutang-alert piutang-alert-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="piutang-alert piutang-alert-success"
                role="status"
              >
                {success}
              </div>
            )}

            <div className="piutang-summary">
              <div className="piutang-summary-card">
                <span>Total Piutang</span>
                <strong>{formatRupiah(totalPiutang)}</strong>
                <small>Penambahan dikurangi penerimaan</small>
              </div>

              <div className="piutang-summary-card">
                <span>Total Penambahan</span>
                <strong>{formatRupiah(totalPenambahan)}</strong>
                <small>Transaksi debit</small>
              </div>

              <div className="piutang-summary-card">
                <span>Total Penerimaan</span>
                <strong>{formatRupiah(totalPenerimaan)}</strong>
                <small>Transaksi kredit</small>
              </div>
            </div>

            <div className="piutang-filter">
              <div className="piutang-filter-item">
                <label htmlFor="filter-jenis-piutang">
                  Jenis transaksi
                </label>

                <select
                  id="filter-jenis-piutang"
                  value={filterJenis}
                  onChange={(event) =>
                    setFilterJenis(event.target.value)
                  }
                >
                  <option value="semua">Semua jenis</option>
                  <option value="debit">Penambahan piutang</option>
                  <option value="kredit">Penerimaan pembayaran</option>
                </select>
              </div>

              <div className="piutang-filter-item">
                <label htmlFor="filter-tanggal-piutang">
                  Tanggal
                </label>

                <input
                  id="filter-tanggal-piutang"
                  type="date"
                  value={filterTanggal}
                  onChange={(event) =>
                    setFilterTanggal(event.target.value)
                  }
                />
              </div>

              <button
                type="button"
                className="piutang-reset-button"
                onClick={() => {
                  setFilterJenis("semua");
                  setFilterTanggal("");
                }}
              >
                Reset Filter
              </button>
            </div>

            <div className="piutang-table-card">
              <div className="piutang-table-heading">
                <div>
                  <h2>Daftar Transaksi</h2>
                  <p>Riwayat transaksi piutang usaha.</p>
                </div>

                <span className="piutang-total-data">
                  {dataTerfilter.length} transaksi
                </span>
              </div>

              {loading ? (
                <div className="piutang-empty">
                  Memuat data transaksi...
                </div>
              ) : (
                <div className="piutang-table-wrapper">
                  <DataTable
                    key={`${pageLength}-${filterJenis}-${filterTanggal}`}
                    data={dataTerfilter}
                    columns={columns}
                    options={options}
                    className="display piutang-data-table"
                  />
                </div>
              )}
            </div>

            {modalOpen && (
              <div
                className="piutang-modal-overlay"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    tutupModal();
                  }
                }}
              >
                <div
                  className="piutang-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="piutang-modal-title"
                >
                  <div className="piutang-modal-header">
                    <div>
                      <h2 id="piutang-modal-title">
                        Tambah Transaksi Piutang
                      </h2>
                      <p>Lengkapi informasi transaksi.</p>
                    </div>

                    <button
                      type="button"
                      className="piutang-modal-close"
                      onClick={tutupModal}
                      disabled={saving}
                      aria-label="Tutup formulir"
                    >
                      ×
                    </button>
                  </div>

                  {error && (
                    <div
                      className="piutang-alert piutang-alert-error"
                      role="alert"
                    >
                      {error}
                    </div>
                  )}

                  <form
                    onSubmit={handleSubmit}
                    className="piutang-form"
                  >
                    <div className="piutang-form-group">
                      <label htmlFor="piutang-tanggal">
                        Tanggal transaksi
                      </label>

                      <input
                        id="piutang-tanggal"
                        type="date"
                        name="tanggal"
                        value={form.tanggal}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="piutang-form-group">
                      <label htmlFor="piutang-jenis">
                        Jenis transaksi
                      </label>

                      <select
                        id="piutang-jenis"
                        name="jenis_transaksi"
                        value={form.jenis_transaksi}
                        onChange={handleChange}
                        required
                      >
                        <option value="debit">
                          Debit — penambahan piutang
                        </option>
                        <option value="kredit">
                          Kredit — penerimaan pembayaran
                        </option>
                      </select>

                      <small>
                        Penerimaan pembayaran akan otomatis menambah kas.
                      </small>
                    </div>

                    <div className="piutang-form-group">
                      <label htmlFor="piutang-nominal">
                        Nominal (Rp)
                      </label>

                      <input
                        id="piutang-nominal"
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

                    <div className="piutang-form-group">
                      <label htmlFor="piutang-keterangan">
                        Keterangan
                      </label>

                      <textarea
                        id="piutang-keterangan"
                        name="keterangan"
                        rows="3"
                        maxLength={1000}
                        placeholder="Contoh: Pembayaran piutang pelanggan"
                        value={form.keterangan}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="piutang-form-actions">
                      <button
                        type="button"
                        className="piutang-secondary-button"
                        onClick={tutupModal}
                        disabled={saving}
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        className="piutang-primary-button"
                        disabled={saving}
                      >
                        {saving ? "Menyimpan..." : "Simpan Transaksi"}
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

export default Piutang;
