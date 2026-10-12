import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DataTable from "datatables.net-react";
import DtCore from "datatables.net-dt";
import JSZip from "jszip";

import "datatables.net-dt/css";
import "datatables.net-buttons-dt/css";
import "datatables.net-buttons-dt";
import "datatables.net-buttons/js/buttons.html5.mjs";

import "../style.css";

import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";

import {
  getBeban,
  createBeban,
  updateBeban,
  deleteBeban,
} from "../../service/bebanService";

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

  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });

const tanggalHariIni = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
};

const FORM_AWAL = () => ({
  tanggal: tanggalHariIni(),
  keterangan: "",
  nominal: "",
  metode_pembayaran: "cash",
});

function Beban() {
  const tableWrapperRef = useRef(null);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filterMetode, setFilterMetode] = useState("semua");
  const [filterTanggal, setFilterTanggal] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(FORM_AWAL);

  const [pageLength, setPageLength] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 768 ? 10 : 20
  );

  useEffect(() => {
    const handleResize = () => {
      setPageLength(window.innerWidth <= 768 ? 10 : 20);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getBeban();
      setData(result ?? []);
    } catch (err) {
      setError(err.message || "Gagal mengambil data beban.");
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
        const cocokMetode =
          filterMetode === "semua" ||
          item.metode_pembayaran === filterMetode;

        const cocokTanggal =
          !filterTanggal || item.tanggal === filterTanggal;

        return cocokMetode && cocokTanggal;
      }),
    [data, filterMetode, filterTanggal]
  );

  const totalBeban = useMemo(
    () =>
      data.reduce(
        (total, item) => total + (Number(item.nominal) || 0),
        0
      ),
    [data]
  );

  const totalCash = useMemo(
    () =>
      data
        .filter((item) => item.metode_pembayaran === "cash")
        .reduce(
          (total, item) => total + (Number(item.nominal) || 0),
          0
        ),
    [data]
  );

  const totalHutang = useMemo(
    () =>
      data
        .filter((item) => item.metode_pembayaran === "hutang")
        .reduce(
          (total, item) => total + (Number(item.nominal) || 0),
          0
        ),
    [data]
  );

  const bukaTambah = () => {
    setEditId(null);
    setForm(FORM_AWAL());
    setError("");
    setSuccess("");
    setModalOpen(true);
  };

  const bukaEdit = useCallback((item) => {
    setEditId(item.id);

    setForm({
      tanggal: item.tanggal || tanggalHariIni(),
      keterangan: item.keterangan || "",
      nominal: String(item.nominal ?? ""),
      metode_pembayaran: item.metode_pembayaran || "cash",
    });

    setError("");
    setSuccess("");
    setModalOpen(true);
  }, []);

  const tutupModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditId(null);
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

    if (!form.keterangan.trim()) {
      setError("Keterangan beban wajib diisi.");
      return;
    }

    if (!Number.isFinite(nominal) || nominal <= 0) {
      setError("Nominal harus lebih besar dari nol.");
      return;
    }

    if (!["cash", "hutang"].includes(form.metode_pembayaran)) {
      setError("Metode pembayaran tidak valid.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        tanggal: form.tanggal,
        keterangan: form.keterangan.trim(),
        nominal,
        metode_pembayaran: form.metode_pembayaran,
      };

      const sedangEdit = editId !== null;

      if (sedangEdit) {
        await updateBeban(editId, payload);
      } else {
        await createBeban(payload);
      }

      setModalOpen(false);
      setEditId(null);
      setForm(FORM_AWAL());

      setSuccess(
        sedangEdit
          ? "Transaksi beban berhasil diperbarui."
          : form.metode_pembayaran === "cash"
            ? "Beban tercatat dan pengeluaran kas ditambahkan."
            : "Beban tercatat dan utang ditambahkan."
      );

      await loadData();
    } catch (err) {
      setError(err.message || "Gagal menyimpan transaksi beban.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = useCallback(
    async (id) => {
      if (
        !window.confirm(
          "Yakin ingin menghapus beban beserta catatan kas atau utangnya?"
        )
      ) {
        return;
      }

      setError("");
      setSuccess("");

      try {
        await deleteBeban(id);
        setSuccess("Transaksi beban berhasil dihapus.");
        await loadData();
      } catch (err) {
        setError(err.message || "Gagal menghapus transaksi beban.");
      }
    },
    [loadData]
  );

  useEffect(() => {
    const wrapper = tableWrapperRef.current;
    if (!wrapper) return;

    const handleTableClick = (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;

      const item = data.find(
        (row) => String(row.id) === button.dataset.id
      );

      if (!item) return;

      if (button.dataset.action === "edit") bukaEdit(item);
      if (button.dataset.action === "delete") handleDelete(item.id);
    };

    wrapper.addEventListener("click", handleTableClick);

    return () => wrapper.removeEventListener("click", handleTableClick);
  }, [data, bukaEdit, handleDelete]);

  const columns = useMemo(
    () => [
      {
        data: "tanggal",
        title: "Tanggal",
        render: (value, type) =>
          type === "display"
            ? escapeHtml(formatTanggal(value))
            : value || "",
      },
      {
        data: "keterangan",
        title: "Keterangan",
        defaultContent: "-",
        render: (value) => escapeHtml(value || "-"),
      },
      {
        data: "metode_pembayaran",
        title: "Metode Pembayaran",
        render: (value, type) => {
          if (type !== "display") return value || "";

          if (value === "cash") {
            return '<span class="beban-badge beban-badge-langsung">Cash</span>';
          }

          return '<span class="beban-badge beban-badge-nanti">Hutang</span>';
        },
      },
      {
        data: "nominal",
        title: "Nominal",
        className: "beban-nominal",
        render: (value, type) =>
          type === "display"
            ? escapeHtml(formatRupiah(value))
            : Number(value) || 0,
      },
      {
        data: null,
        title: "Aksi",
        orderable: false,
        searchable: false,
        render: (_value, type, row) => {
          if (type !== "display") return "";

          return `
            <div class="beban-actions">
              <button
                type="button"
                class="beban-action-edit"
                data-action="edit"
                data-id="${Number(row.id)}"
              >Edit</button>
              <button
                type="button"
                class="beban-action-delete"
                data-action="delete"
                data-id="${Number(row.id)}"
              >Hapus</button>
            </div>
          `;
        },
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
              title: "Laporan Jurnal Beban",
              filename: "laporan-jurnal-beban",
              exportOptions: { columns: [0, 1, 2, 3] },
            },
          ],
        },
        topEnd: "search",
        bottomStart: "info",
        bottomEnd: "paging",
      },
      language: {
        search: "Cari:",
        searchPlaceholder: "Cari transaksi...",
        info: "Menampilkan _START_–_END_ dari _TOTAL_ data",
        infoEmpty: "Belum ada data",
        zeroRecords: "Data tidak ditemukan",
        emptyTable: "Belum ada transaksi beban",
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
          <section className="beban-page">
            <div className="beban-header">
              <div>
                <h1>Jurnal Beban</h1>
                <p>Catat dan kelola pengeluaran operasional usaha.</p>
              </div>

              <button
                type="button"
                className="beban-primary-button"
                onClick={bukaTambah}
              >
                + Tambah Beban
              </button>
            </div>

            {error && !modalOpen && (
              <div className="beban-alert beban-alert-error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="beban-alert beban-alert-success" role="status">
                {success}
              </div>
            )}

            <div className="beban-summary">
              <div className="beban-summary-card">
                <span>Total Beban</span>
                <strong>{formatRupiah(totalBeban)}</strong>
                <small>Seluruh pencatatan beban</small>
              </div>

              <div className="beban-summary-card">
                <span>Pembayaran Cash</span>
                <strong>{formatRupiah(totalCash)}</strong>
                <small>Beban yang dibayar langsung</small>
              </div>

              <div className="beban-summary-card">
                <span>Pembayaran Hutang</span>
                <strong>{formatRupiah(totalHutang)}</strong>
                <small>Beban yang belum dibayar</small>
              </div>
            </div>

            <div className="beban-filter">
              <div className="beban-filter-item">
                <label htmlFor="filter-metode-beban">
                  Metode pembayaran
                </label>

                <select
                  id="filter-metode-beban"
                  value={filterMetode}
                  onChange={(event) => setFilterMetode(event.target.value)}
                >
                  <option value="semua">Semua metode</option>
                  <option value="cash">Cash</option>
                  <option value="hutang">Hutang</option>
                </select>
              </div>

              <div className="beban-filter-item">
                <label htmlFor="filter-tanggal-beban">Tanggal</label>

                <input
                  id="filter-tanggal-beban"
                  type="date"
                  value={filterTanggal}
                  onChange={(event) => setFilterTanggal(event.target.value)}
                />
              </div>

              <button
                type="button"
                className="beban-reset-button"
                onClick={() => {
                  setFilterMetode("semua");
                  setFilterTanggal("");
                }}
              >
                Reset Filter
              </button>
            </div>

            <div className="beban-table-card">
              <div className="beban-table-heading">
                <div>
                  <h2>Daftar Transaksi Beban</h2>
                  <p>Riwayat pengeluaran operasional usaha.</p>
                </div>

                <span className="beban-total-data">
                  {dataTerfilter.length} transaksi
                </span>
              </div>

              {loading ? (
                <div className="beban-empty">Memuat data transaksi...</div>
              ) : (
                <div
                  className="beban-table-wrapper"
                  ref={tableWrapperRef}
                >
                  <DataTable
                    key={`${pageLength}-${filterMetode}-${filterTanggal}`}
                    data={dataTerfilter}
                    columns={columns}
                    options={options}
                    className="display beban-data-table"
                  />
                </div>
              )}
            </div>

            {modalOpen && (
              <div className="beban-modal-overlay">
                <div
                  className="beban-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="beban-modal-title"
                >
                  <div className="beban-modal-header">
                    <div>
                      <h2 id="beban-modal-title">
                        {editId !== null
                          ? "Edit Transaksi Beban"
                          : "Tambah Beban"}
                      </h2>
                      <p>Lengkapi informasi pengeluaran usaha.</p>
                    </div>

                    <button
                      type="button"
                      className="beban-modal-close"
                      onClick={tutupModal}
                      disabled={saving}
                      aria-label="Tutup"
                    >
                      ×
                    </button>
                  </div>

                  {error && (
                    <div className="beban-alert beban-alert-error" role="alert">
                      {error}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="beban-form">
                    <div className="beban-form-group">
                      <label htmlFor="beban-tanggal">
                        Tanggal transaksi
                      </label>

                      <input
                        id="beban-tanggal"
                        type="date"
                        name="tanggal"
                        value={form.tanggal}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="beban-form-group">
                      <label htmlFor="beban-keterangan">
                        Keterangan beban
                      </label>

                      <textarea
                        id="beban-keterangan"
                        name="keterangan"
                        rows="3"
                        maxLength={500}
                        placeholder="Contoh: Pembayaran listrik bulan ini"
                        value={form.keterangan}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="beban-form-group">
                      <label htmlFor="beban-nominal">Nominal (Rp)</label>

                      <input
                        id="beban-nominal"
                        type="number"
                        name="nominal"
                        min="1"
                        step="1"
                        placeholder="Contoh: 250000"
                        value={form.nominal}
                        onChange={handleChange}
                        required
                      />
                    </div>

                    <div className="beban-form-group">
                      <label htmlFor="beban-metode">
                        Metode pembayaran
                      </label>

                      <select
                        id="beban-metode"
                        name="metode_pembayaran"
                        value={form.metode_pembayaran}
                        onChange={handleChange}
                        required
                      >
                        <option value="cash">
                          Cash — kas berkurang
                        </option>
                        <option value="hutang">
                          Hutang — utang bertambah
                        </option>
                      </select>
                    </div>

                    <div className="beban-form-actions">
                      <button
                        type="button"
                        className="beban-secondary-button"
                        onClick={tutupModal}
                        disabled={saving}
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        className="beban-primary-button"
                        disabled={saving}
                      >
                        {saving
                          ? "Menyimpan..."
                          : editId !== null
                            ? "Simpan Perubahan"
                            : "Simpan Beban"}
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

export default Beban;