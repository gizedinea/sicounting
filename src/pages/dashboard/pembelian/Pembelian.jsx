import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "datatables.net-react";
import DtCore from "datatables.net-dt";
import JSZip from "jszip";

import "datatables.net-dt/css";
import "datatables.net-buttons-dt/css";
import "datatables.net-buttons-dt";
import "datatables.net-buttons/js/buttons.html5.mjs";

import Sidebar from "../../../components/Sidebar";
import Header from "../../../components/Header";
import { supabase } from "../../../lib/supabase";

import {
  getPembelian,
  getBarangInventory,
  createPembelian,
  updatePembelian,
  deletePembelian,
} from "../../service/pembelianService";

import "../style.css";

DataTable.use(DtCore);
DtCore.Buttons.jszip(JSZip);

const rupiah = (nilai) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(nilai) || 0);

const tanggalHariIni = () => {
  const sekarang = new Date();
  const tahun = sekarang.getFullYear();
  const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");
  const hari = String(sekarang.getDate()).padStart(2, "0");
  return `${tahun}-${bulan}-${hari}`;
};

const formatTanggal = (tanggal) => {
  if (!tanggal) return "-";

  return new Date(`${tanggal}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const buatFormAwal = () => ({
  tanggal: tanggalHariIni(),
  pilihan_barang: "__baru__",
  nama_barang: "",
  jumlah: "1",
  harga: "",
  metode_pembayaran: "langsung",
});

function Pembelian() {
  const [data, setData] = useState([]);
  const [barangInventory, setBarangInventory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(buatFormAwal);
  const [editId, setEditId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);

  const [filterMetode, setFilterMetode] = useState("semua");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalAkhir, setTanggalAkhir] = useState("");

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
      const [hasilPembelian, hasilInventory] = await Promise.all([
        getPembelian(),
        getBarangInventory(),
      ]);

      setData(hasilPembelian || []);
      setBarangInventory(hasilInventory || []);
    } catch (err) {
      setError(err.message || "Gagal memuat data pembelian dan inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalForm = useMemo(
    () => (Number(form.jumlah) || 0) * (Number(form.harga) || 0),
    [form.jumlah, form.harga]
  );

  const dataTerfilter = useMemo(
    () =>
      data.filter((item) => {
        const cocokMetode =
          filterMetode === "semua" ||
          item.metode_pembayaran === filterMetode;

        const cocokMulai =
          !tanggalMulai || item.tanggal >= tanggalMulai;

        const cocokAkhir =
          !tanggalAkhir || item.tanggal <= tanggalAkhir;

        return cocokMetode && cocokMulai && cocokAkhir;
      }),
    [data, filterMetode, tanggalMulai, tanggalAkhir]
  );

  const ringkasan = useMemo(() => {
    const total = (daftar) =>
      daftar.reduce(
        (sum, item) =>
          sum + Number(item.harga || 0) * Number(item.jumlah || 0),
        0
      );

    return {
      keseluruhan: total(data),
      langsung: total(
        data.filter((item) => item.metode_pembayaran === "langsung")
      ),
      nanti: total(
        data.filter((item) => item.metode_pembayaran === "nanti")
      ),
    };
  }, [data]);

  const bukaTambah = () => {
    setEditId(null);
    setForm(buatFormAwal());
    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  const bukaEdit = (item) => {
    setEditId(item.id);
    setForm({
      tanggal: item.tanggal || tanggalHariIni(),
      pilihan_barang: "__baru__",
      nama_barang: item.nama_barang || "",
      jumlah: String(item.jumlah ?? 1),
      harga: String(item.harga ?? ""),
      metode_pembayaran: item.metode_pembayaran || "langsung",
    });
    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  const tutupForm = () => {
    if (saving) return;

    setFormOpen(false);
    setEditId(null);
    setForm(buatFormAwal());
    setError("");
  };

  const handlePilihanBarang = (event) => {
    const pilihan = event.target.value;

    if (pilihan === "__baru__") {
      setForm((prev) => ({
        ...prev,
        pilihan_barang: pilihan,
        nama_barang: "",
        harga: "",
      }));
      return;
    }

    const barang = barangInventory.find(
      (item) => item.nama_barang === pilihan
    );

    setForm((prev) => ({
      ...prev,
      pilihan_barang: pilihan,
      nama_barang: barang?.nama_barang || "",
      harga: barang ? String(barang.harga || "") : "",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const jumlah = Number(form.jumlah);
    const harga = Number(form.harga);

    if (!form.tanggal || !form.nama_barang.trim()) {
      setError("Tanggal dan nama barang wajib diisi.");
      return;
    }

    if (!Number.isInteger(jumlah) || jumlah <= 0) {
      setError("Jumlah stok harus berupa bilangan bulat lebih besar dari nol.");
      return;
    }

    if (!Number.isFinite(harga) || harga <= 0) {
      setError("Harga harus lebih besar dari nol.");
      return;
    }

    if (!["langsung", "nanti"].includes(form.metode_pembayaran)) {
      setError("Metode pembayaran tidak valid.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Silakan login terlebih dahulu.");

      const payload = {
        users_id: user.id,
        tanggal: form.tanggal,
        nama_barang: form.nama_barang.trim(),
        jumlah,
        harga,
        metode_pembayaran: form.metode_pembayaran,
      };

      if (editId !== null) {
        await updatePembelian(editId, payload);
        setSuccess("Pembelian berhasil diperbarui dan disinkronkan.");
      } else {
        const [tahun, bulan, hari] = form.tanggal.split("-");
        const prefix = `${hari}${bulan}${tahun.slice(-2)}B`;
        const nomorTerpakai = new Set(
          data.map((item) => item.nomor_transaksi)
        );

        let urutan = 1;
        while (nomorTerpakai.has(`${prefix}${urutan}`)) urutan++;

        await createPembelian({
          ...payload,
          nomor_transaksi: `${prefix}${urutan}`,
        });

        setSuccess(
          "Pembelian berhasil ditambahkan. Inventory dan jurnal terkait telah diperbarui."
        );
      }

      setFormOpen(false);
      setEditId(null);
      setForm(buatFormAwal());

      await loadData();
    } catch (err) {
      setError(err.message || "Gagal menyimpan pembelian.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Hapus pembelian ini beserta catatan Inventory, Kas, dan Utang yang terkait?"
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await deletePembelian(id);
      setSuccess("Pembelian dan catatan terkait berhasil dihapus.");
      await loadData();
    } catch (err) {
      setError(err.message || "Gagal menghapus pembelian.");
    }
  };

  const handleTableClick = (event) => {
    const tombol = event.target.closest("button[data-action]");
    if (!tombol) return;

    const item = data.find(
      (row) => String(row.id) === tombol.dataset.id
    );

    if (!item) return;

    if (tombol.dataset.action === "edit") bukaEdit(item);
    if (tombol.dataset.action === "delete") handleDelete(item.id);
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
        data: "nomor_transaksi",
        title: "No. Pembelian",
        defaultContent: "-",
        render: (value) => value || "-",
      },
      {
        data: "nama_barang",
        title: "Nama Barang",
        defaultContent: "-",
      },
      {
        data: "jumlah",
        title: "Jumlah",
        render: (value, type) =>
          type === "display"
            ? Number(value || 0).toLocaleString("id-ID")
            : Number(value || 0),
      },
      {
        data: "harga",
        title: "Harga Satuan",
        render: (value, type) =>
          type === "display" ? rupiah(value) : Number(value || 0),
      },
      {
        data: null,
        title: "Total",
        render: (_value, type, row) => {
          const total =
            Number(row.harga || 0) * Number(row.jumlah || 0);
          return type === "display" ? rupiah(total) : total;
        },
      },
      {
        data: "metode_pembayaran",
        title: "Pembayaran",
        render: (value, type) => {
          if (type !== "display") return value || "";

          const langsung = value === "langsung";
          const label = langsung ? "Langsung" : "Nanti (utang)";
          const kelas = langsung
            ? "pembelian-badge-langsung"
            : "pembelian-badge-nanti";

          return `<span class="${kelas}">${label}</span>`;
        },
      },
      {
        data: null,
        title: "Aksi",
        orderable: false,
        searchable: false,
        render: (_value, type, row) => {
          if (type !== "display") return "";

          return `
            <div class="pembelian-action-group">
              <button
                type="button"
                class="pembelian-action-edit"
                data-action="edit"
                data-id="${Number(row.id)}"
              >Edit</button>
              <button
                type="button"
                class="pembelian-action-delete"
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
      order: [[0, "desc"]],
      autoWidth: false,
      scrollX: true,
      layout: {
        topStart: {
          buttons: [
            {
              extend: "excelHtml5",
              text: "Ekspor Excel",
              title: "Jurnal_Pembelian_Sicounting",
              filename: "jurnal-pembelian-sicounting",
              exportOptions: { columns: [0, 1, 2, 3, 4, 5, 6] },
            },
          ],
        },
        topEnd: "search",
        bottomStart: "info",
        bottomEnd: "paging",
      },
      language: {
        search: "Cari:",
        searchPlaceholder: "Cari pembelian...",
        emptyTable: "Belum ada data pembelian.",
        zeroRecords: "Data pembelian tidak ditemukan.",
        info: "Menampilkan _START_–_END_ dari _TOTAL_ transaksi",
        infoEmpty: "Belum ada transaksi",
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
          <section className="pembelian-page">
            <div className="pembelian-header">
              <div>
                <h1>Jurnal Pembelian</h1>
                <p>
                  Catat pembelian, tambah stok Inventory, dan sinkronkan
                  pembayaran ke Kas atau Utang.
                </p>
              </div>

              <button
                type="button"
                className="pembelian-btn pembelian-btn-primary"
                onClick={bukaTambah}
              >
                + Tambah Pembelian
              </button>
            </div>

            {error && (
              <div
                className="pembelian-alert pembelian-alert-error"
                role="alert"
              >
                {error}
              </div>
            )}

            {success && (
              <div
                className="pembelian-alert pembelian-alert-success"
                role="status"
              >
                {success}
              </div>
            )}

            <div className="pembelian-summary">
              <article className="pembelian-summary-card">
                <span>Total Pembelian</span>
                <strong>{rupiah(ringkasan.keseluruhan)}</strong>
              </article>

              <article className="pembelian-summary-card">
                <span>Pembayaran Langsung</span>
                <strong className="pembelian-langsung">
                  {rupiah(ringkasan.langsung)}
                </strong>
              </article>

              <article className="pembelian-summary-card">
                <span>Pembayaran Nanti</span>
                <strong className="pembelian-nanti">
                  {rupiah(ringkasan.nanti)}
                </strong>
              </article>
            </div>

            <div className="pembelian-filter">
              <div className="pembelian-field">
                <label htmlFor="filter-metode">Metode pembayaran</label>
                <select
                  id="filter-metode"
                  value={filterMetode}
                  onChange={(event) => setFilterMetode(event.target.value)}
                >
                  <option value="semua">Semua metode</option>
                  <option value="langsung">Langsung</option>
                  <option value="nanti">Nanti (utang)</option>
                </select>
              </div>

              <div className="pembelian-field">
                <label htmlFor="filter-mulai">Dari tanggal</label>
                <input
                  id="filter-mulai"
                  type="date"
                  value={tanggalMulai}
                  max={tanggalAkhir || undefined}
                  onChange={(event) => setTanggalMulai(event.target.value)}
                />
              </div>

              <div className="pembelian-field">
                <label htmlFor="filter-akhir">Sampai tanggal</label>
                <input
                  id="filter-akhir"
                  type="date"
                  value={tanggalAkhir}
                  min={tanggalMulai || undefined}
                  onChange={(event) => setTanggalAkhir(event.target.value)}
                />
              </div>

              <button
                type="button"
                className="pembelian-btn pembelian-btn-secondary"
                onClick={() => {
                  setFilterMetode("semua");
                  setTanggalMulai("");
                  setTanggalAkhir("");
                }}
              >
                Reset Filter
              </button>
            </div>

            <div className="pembelian-table-card">
              {loading ? (
                <p className="pembelian-loading">Memuat data pembelian...</p>
              ) : (
                <div
                  className="pembelian-table-wrapper"
                  onClick={handleTableClick}
                >
                  <DataTable
                    key={pageLength}
                    data={dataTerfilter}
                    columns={columns}
                    options={options}
                    className="display"
                  />
                </div>
              )}
            </div>

            {formOpen && (
              <div
                className="pembelian-modal-overlay"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) tutupForm();
                }}
              >
                <div
                  className="pembelian-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="pembelian-form-title"
                >
                  <div className="pembelian-modal-header">
                    <div>
                      <h2 id="pembelian-form-title">
                        {editId !== null ? "Edit Pembelian" : "Tambah Pembelian"}
                      </h2>
                      <p>
                        Pilih barang lama untuk menambah stok, atau buat barang
                        baru.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="pembelian-modal-close"
                      onClick={tutupForm}
                      disabled={saving}
                      aria-label="Tutup formulir"
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div className="pembelian-field">
                      <label htmlFor="form-tanggal">Tanggal</label>
                      <input
                        id="form-tanggal"
                        type="date"
                        value={form.tanggal}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            tanggal: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>

                    {editId === null && (
                      <div className="pembelian-field">
                        <label htmlFor="form-pilihan-barang">
                          Pilih barang
                        </label>
                        <select
                          id="form-pilihan-barang"
                          value={form.pilihan_barang}
                          onChange={handlePilihanBarang}
                        >
                          <option value="__baru__">+ Barang baru</option>
                          {barangInventory.map((barang) => (
                            <option
                              key={barang.nama_barang}
                              value={barang.nama_barang}
                            >
                              {barang.nama_barang} — stok saat ini:{" "}
                              {barang.stok}
                            </option>
                          ))}
                        </select>
                        <small>
                          Pilih barang yang sudah ada untuk menambah stoknya.
                        </small>
                      </div>
                    )}

                    <div className="pembelian-field">
                      <label htmlFor="form-nama">Nama barang</label>
                      <input
                        id="form-nama"
                        type="text"
                        maxLength={150}
                        value={form.nama_barang}
                        readOnly={
                          editId === null &&
                          form.pilihan_barang !== "__baru__"
                        }
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            nama_barang: event.target.value,
                          }))
                        }
                        placeholder="Contoh: Buku tulis"
                        required
                      />
                    </div>

                    <div className="pembelian-form-grid">
                      <div className="pembelian-field">
                        <label htmlFor="form-jumlah">Jumlah stok dibeli</label>
                        <input
                          id="form-jumlah"
                          type="number"
                          min="1"
                          step="1"
                          value={form.jumlah}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              jumlah: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>

                      <div className="pembelian-field">
                        <label htmlFor="form-harga">Harga per unit (Rp)</label>
                        <input
                          id="form-harga"
                          type="number"
                          min="1"
                          step="1"
                          value={form.harga}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              harga: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="pembelian-total-preview">
                      <span>Total pembelian</span>
                      <strong>{rupiah(totalForm)}</strong>
                    </div>

                    <div className="pembelian-field">
                      <label htmlFor="form-metode">Metode pembayaran</label>
                      <select
                        id="form-metode"
                        value={form.metode_pembayaran}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            metode_pembayaran: event.target.value,
                          }))
                        }
                        required
                      >
                        <option value="langsung">
                          Langsung — mengurangi kas
                        </option>
                        <option value="nanti">
                          Nanti — menambah utang
                        </option>
                      </select>
                    </div>

                    {form.metode_pembayaran === "langsung" ? (
                      <p className="pembelian-payment-info">
                        Total {rupiah(totalForm)} akan dicatat sebagai
                        pengeluaran pada Jurnal Kas.
                      </p>
                    ) : (
                      <p className="pembelian-payment-info">
                        Total {rupiah(totalForm)} akan dicatat sebagai utang
                        pada Jurnal Utang tanpa mengurangi kas.
                      </p>
                    )}

                    <div className="pembelian-form-actions">
                      <button
                        type="button"
                        className="pembelian-btn pembelian-btn-secondary"
                        onClick={tutupForm}
                        disabled={saving}
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        className="pembelian-btn pembelian-btn-primary"
                        disabled={saving}
                      >
                        {saving
                          ? "Menyimpan..."
                          : editId !== null
                            ? "Simpan Perubahan"
                            : "Simpan Pembelian"}
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

export default Pembelian;
