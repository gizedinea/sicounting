import { useEffect, useMemo, useState } from "react";
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
  getKas,
  createKas,
} from "../../service/kasService";

import "../style.css";

DataTable.use(DtCore);
DtCore.Buttons.jszip(JSZip);

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatTanggal = (tanggal) => {
  if (!tanggal) return "-";

  return new Date(`${tanggal}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const tanggalHariIni = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

function buatFormAwal() {
  return {
    tanggal: tanggalHariIni(),
    jenis_transaksi: "pemasukan",
    nominal: "",
    keterangan: "",
  };
}

function Kas() {
  const [dataKas, setDataKas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState(buatFormAwal);
  const [formOpen, setFormOpen] = useState(false);

  const [filterJenis, setFilterJenis] = useState("semua");
  const [tanggalMulai, setTanggalMulai] = useState("");
  const [tanggalAkhir, setTanggalAkhir] = useState("");

  const [pageLength, setPageLength] = useState(() =>
    window.innerWidth <= 768 ? 10 : 20
  );

  useEffect(() => {
    const handleResize = () => {
      setPageLength(window.innerWidth <= 768 ? 10 : 20);
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadKas = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getKas();
      setDataKas(result || []);
    } catch (err) {
      setError(err.message || "Gagal mengambil data jurnal kas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKas();
  }, []);

  const dataTerfilter = useMemo(() => {
    return dataKas.filter((item) => {
      const cocokJenis =
        filterJenis === "semua" ||
        item.jenis_transaksi === filterJenis;

      const cocokTanggalMulai =
        !tanggalMulai || item.tanggal >= tanggalMulai;

      const cocokTanggalAkhir =
        !tanggalAkhir || item.tanggal <= tanggalAkhir;

      return cocokJenis && cocokTanggalMulai && cocokTanggalAkhir;
    });
  }, [dataKas, filterJenis, tanggalMulai, tanggalAkhir]);

  const ringkasan = useMemo(() => {
    const pemasukan = dataKas.reduce(
      (total, item) =>
        item.jenis_transaksi === "pemasukan"
          ? total + Number(item.nominal || 0)
          : total,
      0
    );

    const pengeluaran = dataKas.reduce(
      (total, item) =>
        item.jenis_transaksi === "pengeluaran"
          ? total + Number(item.nominal || 0)
          : total,
      0
    );

    return {
      pemasukan,
      pengeluaran,
      saldo: pemasukan - pengeluaran,
    };
  }, [dataKas]);

  const bukaTambah = () => {
    setForm(buatFormAwal());
    setError("");
    setSuccess("");
    setFormOpen(true);
  };

  const tutupForm = () => {
    if (saving) return;

    setFormOpen(false);
    setForm(buatFormAwal());
    setError("");
  };

  const buatNomorTransaksi = (tanggal, jenis) => {
    const [tahun, bulan, hari] = tanggal.split("-");
    const tanggalKode = `${hari}${bulan}${tahun.slice(-2)}`;

    const kodeJenis = jenis === "pemasukan" ? "M" : "K";
    const prefix = `${tanggalKode}${kodeJenis}`;

    const nomorYangAda = new Set(
      dataKas.map((item) => item.nomor_transaksi).filter(Boolean)
    );

    let nomorUrut = 1;
    let nomor = `${prefix}${nomorUrut}`;

    while (nomorYangAda.has(nomor)) {
      nomorUrut++;
      nomor = `${prefix}${nomorUrut}`;
    }

    return nomor;
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

    if (
      !["pemasukan", "pengeluaran"].includes(form.jenis_transaksi)
    ) {
      setError("Jenis transaksi tidak valid.");
      return;
    }

    if (!Number.isFinite(nominal) || nominal <= 0) {
      setError("Nominal harus lebih besar dari Rp0.");
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
        user_id: user.id,
        tanggal: form.tanggal,
        jenis_transaksi: form.jenis_transaksi,
        nominal,
        keterangan: form.keterangan.trim(),
        nomor_transaksi: buatNomorTransaksi(
          form.tanggal,
          form.jenis_transaksi
        ),
      };

      await createKas(payload);

      setSuccess(
        `${form.jenis_transaksi === "pemasukan" ? "Pemasukan" : "Pengeluaran"} kas berhasil ditambahkan.`
      );

      setFormOpen(false);
      setForm(buatFormAwal());

      await loadKas();
    } catch (err) {
      setError(err.message || "Transaksi gagal disimpan.");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      data: "tanggal",
      title: "Tanggal",
      render: (value, type) =>
        type === "display" ? formatTanggal(value) : value || "",
    },
    {
      data: "nomor_transaksi",
      title: "No. Transaksi",
      defaultContent: "-",
    },
    {
      data: "jenis_transaksi",
      title: "Jenis Transaksi",
      render: (value, type) => {
        if (type !== "display") return value || "";

        const label =
          value === "pemasukan" ? "Pemasukan" : "Pengeluaran";

        const className =
          value === "pemasukan"
            ? "kas-badge-income"
            : "kas-badge-expense";

        return `<span class="${className}">${label}</span>`;
      },
    },
    {
      data: "nominal",
      title: "Nominal",
      render: (value, type) =>
        type === "display"
          ? formatRupiah(value)
          : Number(value) || 0,
    },
    {
      data: "keterangan",
      title: "Keterangan",
      defaultContent: "-",
    },
  ];

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
              title: "Jurnal_Kas_Sicounting",
              filename: "jurnal-kas-sicounting",
              exportOptions: {
                columns: [0, 1, 2, 3, 4],
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
        searchPlaceholder: "Cari transaksi...",
        zeroRecords: "Data transaksi tidak ditemukan.",
        emptyTable: "Belum ada transaksi kas.",
        info: "Menampilkan _START_–_END_ dari _TOTAL_ transaksi",
        infoEmpty: "Belum ada transaksi",
        infoFiltered: "(disaring dari _MAX_ transaksi)",
        paginate: {
          first: "Pertama",
          last: "Terakhir",
          next: "Berikutnya",
          previous: "Sebelumnya",
        },
        buttons: {
          excel: "Ekspor Excel",
          excelHtml5: "Ekspor Excel",
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
          <section className="kas-page">
            <div className="kas-header">
              <div>
                <h1>Jurnal Kas</h1>
                <p>
                  Catat dan pantau seluruh pemasukan serta pengeluaran usaha.
                </p>
              </div>

              <button
                type="button"
                className="kas-btn kas-btn-primary"
                onClick={bukaTambah}
              >
                + Tambah Transaksi
              </button>
            </div>

            {error && (
              <div className="kas-alert kas-alert-error" role="alert">
                {error}
              </div>
            )}

            {success && (
              <div className="kas-alert kas-alert-success" role="status">
                {success}
              </div>
            )}

            <div className="kas-summary">
              <article className="kas-summary-card">
                <span>Total Pemasukan</span>
                <strong className="kas-income">
                  {formatRupiah(ringkasan.pemasukan)}
                </strong>
              </article>

              <article className="kas-summary-card">
                <span>Total Pengeluaran</span>
                <strong className="kas-expense">
                  {formatRupiah(ringkasan.pengeluaran)}
                </strong>
              </article>

              <article className="kas-summary-card">
                <span>Saldo Bersih</span>
                <strong>{formatRupiah(ringkasan.saldo)}</strong>
              </article>
            </div>

            <div className="kas-filter">
              <div className="kas-filter-field">
                <label htmlFor="kas-jenis">Jenis transaksi</label>
                <select
                  id="kas-jenis"
                  value={filterJenis}
                  onChange={(event) =>
                    setFilterJenis(event.target.value)
                  }
                >
                  <option value="semua">Semua jenis</option>
                  <option value="pemasukan">Pemasukan</option>
                  <option value="pengeluaran">Pengeluaran</option>
                </select>
              </div>

              <div className="kas-filter-field">
                <label htmlFor="kas-tanggal-mulai">Dari tanggal</label>
                <input
                  id="kas-tanggal-mulai"
                  type="date"
                  value={tanggalMulai}
                  max={tanggalAkhir || undefined}
                  onChange={(event) =>
                    setTanggalMulai(event.target.value)
                  }
                />
              </div>

              <div className="kas-filter-field">
                <label htmlFor="kas-tanggal-akhir">Sampai tanggal</label>
                <input
                  id="kas-tanggal-akhir"
                  type="date"
                  value={tanggalAkhir}
                  min={tanggalMulai || undefined}
                  onChange={(event) =>
                    setTanggalAkhir(event.target.value)
                  }
                />
              </div>

              <button
                type="button"
                className="kas-btn kas-btn-secondary"
                onClick={() => {
                  setFilterJenis("semua");
                  setTanggalMulai("");
                  setTanggalAkhir("");
                }}
              >
                Reset Filter
              </button>
            </div>

            <div className="kas-table-card">
              {loading ? (
                <p className="kas-loading">
                  Memuat data jurnal kas...
                </p>
              ) : (
                <div className="kas-table-wrapper">
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
                className="kas-modal-overlay"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) {
                    tutupForm();
                  }
                }}
              >
                <div
                  className="kas-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="kas-form-title"
                >
                  <div className="kas-modal-header">
                    <div>
                      <h2 id="kas-form-title">
                        Tambah Transaksi Kas
                      </h2>
                      <p>Lengkapi informasi transaksi berikut.</p>
                    </div>

                    <button
                      type="button"
                      className="kas-modal-close"
                      onClick={tutupForm}
                      disabled={saving}
                      aria-label="Tutup formulir"
                    >
                      ×
                    </button>
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div className="kas-form-field">
                      <label htmlFor="kas-form-tanggal">Tanggal</label>
                      <input
                        id="kas-form-tanggal"
                        type="date"
                        value={form.tanggal}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            tanggal: event.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="kas-form-field">
                      <label htmlFor="kas-form-jenis">
                        Jenis transaksi
                      </label>
                      <select
                        id="kas-form-jenis"
                        value={form.jenis_transaksi}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            jenis_transaksi: event.target.value,
                          })
                        }
                        required
                      >
                        <option value="pemasukan">Pemasukan</option>
                        <option value="pengeluaran">Pengeluaran</option>
                      </select>
                    </div>

                    <div className="kas-form-field">
                      <label htmlFor="kas-form-nominal">
                        Nominal (Rp)
                      </label>
                      <input
                        id="kas-form-nominal"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Contoh: 500000"
                        value={form.nominal}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            nominal: event.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div className="kas-form-field">
                      <label htmlFor="kas-form-keterangan">
                        Keterangan
                      </label>
                      <textarea
                        id="kas-form-keterangan"
                        rows="3"
                        placeholder="Contoh: Saldo awal usaha atau biaya listrik"
                        value={form.keterangan}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            keterangan: event.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    {error && (
                      <div
                        className="kas-alert kas-alert-error"
                        role="alert"
                      >
                        {error}
                      </div>
                    )}

                    <div className="kas-form-actions">
                      <button
                        type="button"
                        className="kas-btn kas-btn-secondary"
                        onClick={tutupForm}
                        disabled={saving}
                      >
                        Batal
                      </button>

                      <button
                        type="submit"
                        className="kas-btn kas-btn-primary"
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

export default Kas;