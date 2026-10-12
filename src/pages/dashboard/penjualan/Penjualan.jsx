
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
  getPenjualan,
  getBarangInventory,
  createPenjualan,
  updatePenjualan,
  deletePenjualan,
} from "../../service/penjualanService";

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

  return [
    sekarang.getFullYear(),
    String(sekarang.getMonth() + 1).padStart(2, "0"),
    String(sekarang.getDate()).padStart(2, "0"),
  ].join("-");
};

const formatTanggal = (tanggal) => {
  if (!tanggal) return "-";

  const hasil = new Date(`${tanggal}T00:00:00`);

  if (Number.isNaN(hasil.getTime())) return "-";

  return hasil.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const escapeHtml = (nilai) =>
  String(nilai ?? "").replace(/[&<>"']/g, (karakter) => {
    const karakterMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return karakterMap[karakter];
  });

const totalItem = (item) =>
  Number(item.jumlah || 0) * Number(item.harga || 0);

const formAwal = {
  tanggal: tanggalHariIni(),
  nama_barang: "",
  jumlah: "1",
  harga: "",
  metode_pembayaran: "langsung",
};

function Penjualan() {
  const [data, setData] = useState([]);
  const [barangInventory, setBarangInventory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(formAwal);
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
      const [hasilPenjualan, hasilInventory] = await Promise.all([
        getPenjualan(),
        getBarangInventory(),
      ]);

      setData(hasilPenjualan || []);
      setBarangInventory(hasilInventory || []);
    } catch (err) {
      setError(err.message || "Gagal memuat data penjualan.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const barangDipilih = useMemo(
    () =>
      barangInventory.find(
        (item) =>
          item.nama_barang.toLocaleLowerCase("id-ID") ===
          form.nama_barang.toLocaleLowerCase("id-ID")
      ),
    [barangInventory, form.nama_barang]
  );

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
          !tanggalMulai || (item.tanggal && item.tanggal >= tanggalMulai);

        const cocokAkhir =
          !tanggalAkhir || (item.tanggal && item.tanggal <= tanggalAkhir);

        return cocokMetode && cocokMulai && cocokAkhir;
      }),
    [data, filterMetode, tanggalMulai, tanggalAkhir]
  );

  const ringkasan = useMemo(() => {
    const totalPenjualan = data.reduce(
      (total, item) => total + totalItem(item),
      0
    );

    const penjualanLangsung = data
      .filter((item) => item.metode_pembayaran === "langsung")
      .reduce((total, item) => total + totalItem(item), 0);

    const penjualanNanti = data
      .filter((item) => item.metode_pembayaran === "nanti")
      .reduce((total, item) => total + totalItem(item), 0);

    return { totalPenjualan, penjualanLangsung, penjualanNanti };
  }, [data]);

  const bukaTambah = () => {
    setForm({ ...formAwal, tanggal: tanggalHariIni() });
    setEditId(null);
    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  const bukaEdit = (item) => {
    setForm({
      tanggal: item.tanggal || tanggalHariIni(),
      nama_barang: item.nama_barang || "",
      jumlah: String(item.jumlah ?? 1),
      harga: String(item.harga ?? ""),
      metode_pembayaran: item.metode_pembayaran || "langsung",
    });

    setEditId(item.id);
    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  const tutupForm = () => {
    if (saving) return;

    setFormOpen(false);
    setEditId(null);
    setForm({ ...formAwal, tanggal: tanggalHariIni() });
    setError("");
  };

  const pilihBarang = (namaBarang) => {
    const barang = barangInventory.find(
      (item) => item.nama_barang === namaBarang
    );

    setForm((sebelumnya) => ({
      ...sebelumnya,
      nama_barang: namaBarang,
      harga: barang ? String(barang.harga || "") : "",
    }));
  };

  const buatNomorPenjualan = (tanggal) => {
    const [tahun, bulan, hari] = tanggal.split("-");
    const awalan = `${hari}${bulan}${tahun.slice(-2)}J`;

    const nomorAda = new Set(
      data.map((item) => item.no_penjualan).filter(Boolean)
    );

    let urutan = 1;
    let nomor = `${awalan}${urutan}`;

    while (nomorAda.has(nomor)) {
      urutan += 1;
      nomor = `${awalan}${urutan}`;
    }

    return nomor;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const jumlah = Number(form.jumlah);
    const harga = Number(form.harga);

    if (!form.tanggal || !form.nama_barang) {
      setError("Tanggal dan barang wajib dipilih.");
      return;
    }

    if (!barangDipilih) {
      setError("Barang tidak ditemukan di Inventory.");
      return;
    }

    if (
      !Number.isInteger(jumlah) ||
      jumlah <= 0 ||
      jumlah > 32767
    ) {
      setError("Jumlah harus berupa bilangan bulat antara 1–32767.");
      return;
    }

    // Saat edit, stok tersedia ditambah kembali dengan jumlah lama
    // agar validasi memperhitungkan barang pada transaksi yang diedit.
    const transaksiLama = data.find((item) => item.id === editId);

    const stokDapatDipakai =
      Number(barangDipilih.stok || 0) +
      (transaksiLama &&
      transaksiLama.nama_barang.toLocaleLowerCase("id-ID") ===
        form.nama_barang.toLocaleLowerCase("id-ID")
        ? Number(transaksiLama.jumlah || 0)
        : 0);

    if (jumlah > stokDapatDipakai) {
      setError(
        `Stok tidak mencukupi. Stok tersedia: ${stokDapatDipakai} unit.`
      );
      return;
    }

    if (!Number.isFinite(harga) || harga <= 0) {
      setError("Harga jual harus lebih besar dari nol.");
      return;
    }

    if (!["langsung", "nanti"].includes(form.metode_pembayaran)) {
      setError("Metode pembayaran tidak valid.");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        tanggal: form.tanggal,
        no_penjualan:
          transaksiLama?.no_penjualan || buatNomorPenjualan(form.tanggal),
        nama_barang: form.nama_barang,
        jumlah,
        harga,
        metode_pembayaran: form.metode_pembayaran,
      };

      if (editId) {
        await updatePenjualan(editId, payload);
        setSuccess("Penjualan berhasil diperbarui.");
      } else {
        await createPenjualan({
          id: crypto.randomUUID(),
          ...payload,
        });
        setSuccess("Penjualan berhasil ditambahkan.");
      }

      setFormOpen(false);
      setEditId(null);
      setForm({ ...formAwal, tanggal: tanggalHariIni() });

      await loadData();
    } catch (err) {
      setError(err.message || "Gagal menyimpan penjualan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Yakin ingin menghapus transaksi penjualan ini?")) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await deletePenjualan(id);
      setSuccess("Penjualan berhasil dihapus dan stok dikembalikan.");
      await loadData();
    } catch (err) {
      setError(err.message || "Gagal menghapus penjualan.");
    }
  };

  const handleTableClick = (event) => {
    const tombol = event.target.closest("button[data-action]");
    if (!tombol) return;

    const item = data.find((row) => String(row.id) === tombol.dataset.id);
    if (!item) return;

    if (tombol.dataset.action === "edit") {
      bukaEdit(item);
    } else if (tombol.dataset.action === "delete") {
      handleDelete(item.id);
    }
  };

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
              title: "Jurnal_Penjualan_Sicounting",
              exportOptions: { columns: [0, 1, 2, 3, 4, 5] },
            },
          ],
        },
        topEnd: "search",
        bottomStart: "info",
        bottomEnd: "paging",
      },
      language: {
        search: "Cari:",
        searchPlaceholder: "Cari penjualan...",
        emptyTable: "Belum ada data penjualan.",
        zeroRecords: "Data penjualan tidak ditemukan.",
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
      columnDefs: [
        { targets: 6, orderable: false, searchable: false },
      ],
    }),
    [pageLength]
  );

  const columns = useMemo(
    () => [
      {
        data: "tanggal",
        render: (value, type) =>
          type === "display" ? formatTanggal(value) : value || "",
      },
      {
        data: "no_penjualan",
        defaultContent: "-",
        render: (value, type) =>
          type === "display" ? escapeHtml(value || "-") : value || "",
      },
      {
        data: "nama_barang",
        defaultContent: "-",
        render: (value, type) =>
          type === "display" ? escapeHtml(value || "-") : value || "",
      },
      {
        data: "jumlah",
        render: (value, type) =>
          type === "display"
            ? Number(value || 0).toLocaleString("id-ID")
            : Number(value || 0),
      },
      {
        data: "harga",
        render: (value, type, row) => {
          const total = Number(value || 0) * Number(row.jumlah || 0);
          return type === "display" ? rupiah(total) : total;
        },
      },
      {
        data: "metode_pembayaran",
        render: (value, type) => {
          if (type !== "display") return value || "";

          const langsung = value === "langsung";
          const label = langsung ? "Langsung" : "Nanti";
          const className = langsung
            ? "penjualan-badge-langsung"
            : "penjualan-badge-nanti";

          return `<span class="${className}">${label}</span>`;
        },
      },
      {
        data: null,
        render: (_value, type, row) => {
          if (type !== "display") return "";

          const id = escapeHtml(row.id);

          return `
            <div class="penjualan-action-group">
              <button type="button"
                class="penjualan-action-edit"
                data-action="edit"
                data-id="${id}">Edit</button>
              <button type="button"
                class="penjualan-action-delete"
                data-action="delete"
                data-id="${id}">Hapus</button>
            </div>
          `;
        },
      },
    ],
    []
  );

  return (
    <div className="dashboard-page">
      <Sidebar />

      <div className="dashboard-main">
        <Header />

        <main className="dashboard-content">
          <section className="penjualan-page">
            <header className="penjualan-header">
              <div>
                <h1>Jurnal Penjualan</h1>
                <p>Catat penjualan dan pantau penerimaan usaha.</p>
              </div>

              <button
                type="button"
                className="penjualan-btn penjualan-btn-primary"
                onClick={bukaTambah}
              >
                + Tambah Penjualan
              </button>
            </header>

            {error && !formOpen && (
              <div className="penjualan-alert penjualan-alert-error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="penjualan-alert penjualan-alert-success" role="status">
                {success}
              </div>
            )}

            <div className="penjualan-summary">
              <article className="penjualan-summary-card">
                <span>Total Penjualan</span>
                <strong>{rupiah(ringkasan.totalPenjualan)}</strong>
              </article>

              <article className="penjualan-summary-card">
                <span>Penjualan Langsung</span>
                <strong className="penjualan-langsung">
                  {rupiah(ringkasan.penjualanLangsung)}
                </strong>
              </article>

              <article className="penjualan-summary-card">
                <span>Penjualan Nanti</span>
                <strong className="penjualan-nanti">
                  {rupiah(ringkasan.penjualanNanti)}
                </strong>
              </article>
            </div>

            <div className="penjualan-filter">
              <div className="penjualan-field">
                <label htmlFor="penjualan-filter-metode">Metode pembayaran</label>
                <select
                  id="penjualan-filter-metode"
                  value={filterMetode}
                  onChange={(event) => setFilterMetode(event.target.value)}
                >
                  <option value="semua">Semua metode</option>
                  <option value="langsung">Langsung</option>
                  <option value="nanti">Nanti (piutang)</option>
                </select>
              </div>

              <div className="penjualan-field">
                <label htmlFor="penjualan-tanggal-mulai">Dari tanggal</label>
                <input
                  id="penjualan-tanggal-mulai"
                  type="date"
                  value={tanggalMulai}
                  max={tanggalAkhir || undefined}
                  onChange={(event) => setTanggalMulai(event.target.value)}
                />
              </div>

              <div className="penjualan-field">
                <label htmlFor="penjualan-tanggal-akhir">Sampai tanggal</label>
                <input
                  id="penjualan-tanggal-akhir"
                  type="date"
                  value={tanggalAkhir}
                  min={tanggalMulai || undefined}
                  onChange={(event) => setTanggalAkhir(event.target.value)}
                />
              </div>

              <button
                type="button"
                className="penjualan-btn penjualan-btn-secondary"
                onClick={() => {
                  setFilterMetode("semua");
                  setTanggalMulai("");
                  setTanggalAkhir("");
                }}
              >
                Reset Filter
              </button>
            </div>

            <div className="penjualan-table-card">
              {loading ? (
                <p className="penjualan-loading">Memuat data penjualan...</p>
              ) : (
                <div
                  className="penjualan-table-wrapper"
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
                className="penjualan-modal-overlay"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) tutupForm();
                }}
              >
                <div
                  className="penjualan-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="penjualan-form-title"
                >
                  <div className="penjualan-modal-header">
                    <div>
                      <h2 id="penjualan-form-title">
                        {editId ? "Edit Penjualan" : "Tambah Penjualan"}
                      </h2>
                      <p>Pilih barang dari Inventory dan isi transaksi.</p>
                    </div>

                    <button
                      type="button"
                      className="penjualan-modal-close"
                      onClick={tutupForm}
                      disabled={saving}
                      aria-label="Tutup formulir"
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div className="penjualan-field">
                      <label htmlFor="penjualan-tanggal">Tanggal</label>
                      <input
                        id="penjualan-tanggal"
                        type="date"
                        value={form.tanggal}
                        onChange={(event) =>
                          setForm((sebelumnya) => ({
                            ...sebelumnya,
                            tanggal: event.target.value,
                          }))
                        }
                        required
                      />
                    </div>

                    <div className="penjualan-field">
                      <label htmlFor="penjualan-nama">Barang dari Inventory</label>
                      <select
                        id="penjualan-nama"
                        value={form.nama_barang}
                        onChange={(event) => pilihBarang(event.target.value)}
                        required
                      >
                        <option value="">Pilih barang</option>
                        {barangInventory.map((barang) => (
                          <option
                            key={barang.nama_barang}
                            value={barang.nama_barang}
                            disabled={
                              Number(barang.stok) <= 0 &&
                              barang.nama_barang !== form.nama_barang
                            }
                          >
                            {barang.nama_barang} — stok {barang.stok}
                          </option>
                        ))}
                      </select>
                    </div>

                    {barangDipilih && (
                      <div className="penjualan-total-preview">
                        <span>Stok tersedia</span>
                        <strong>{barangDipilih.stok} unit</strong>
                      </div>
                    )}

                    <div className="penjualan-form-grid">
                      <div className="penjualan-field">
                        <label htmlFor="penjualan-jumlah">Jumlah</label>
                        <input
                          id="penjualan-jumlah"
                          type="number"
                          min="1"
                          max="32767"
                          step="1"
                          value={form.jumlah}
                          onChange={(event) =>
                            setForm((sebelumnya) => ({
                              ...sebelumnya,
                              jumlah: event.target.value,
                            }))
                          }
                          required
                        />
                      </div>

                      <div className="penjualan-field">
                        <label htmlFor="penjualan-harga">Harga jual per unit (Rp)</label>
                        <input
                          id="penjualan-harga"
                          type="number"
                          min="1"
                          step="1"
                          value={form.harga}
                          onChange={(event) =>
                            setForm((sebelumnya) => ({
                              ...sebelumnya,
                              harga: event.target.value,
                            }))
                          }
                          placeholder="Contoh: 30000"
                          required
                        />
                      </div>
                    </div>

                    <div className="penjualan-total-preview">
                      <span>Total penjualan</span>
                      <strong>{rupiah(totalForm)}</strong>
                    </div>

                    <div className="penjualan-field">
                      <label htmlFor="penjualan-metode">Metode pembayaran</label>
                      <select
                        id="penjualan-metode"
                        value={form.metode_pembayaran}
                        onChange={(event) =>
                          setForm((sebelumnya) => ({
                            ...sebelumnya,
                            metode_pembayaran: event.target.value,
                          }))
                        }
                      >
                        <option value="langsung">Cash (menambah Kas)</option>
                        <option value="nanti">Piutang (pembayaran nanti)</option>
                      </select>
                    </div>

                    {error && (
                      <div
                        className="penjualan-alert penjualan-alert-error"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}

                    <div className="penjualan-form-actions">
                      <button
                        type="button"
                        className="penjualan-btn penjualan-btn-secondary"
                        onClick={tutupForm}
                        disabled={saving}
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        className="penjualan-btn penjualan-btn-primary"
                        disabled={saving}
                      >
                        {saving
                          ? "Menyimpan..."
                          : editId
                            ? "Simpan Perubahan"
                            : "Simpan Penjualan"}
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

export default Penjualan;
