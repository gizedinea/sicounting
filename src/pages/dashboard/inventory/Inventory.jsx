import { useCallback, useEffect, useMemo, useState } from "react";
import DataTable from "datatables.net-react";
import DtCore from "datatables.net-dt";
import JSZip from "jszip";

import "datatables.net-dt/css";
import "datatables.net-buttons-dt/css";
import "datatables.net-buttons-dt";
import "datatables.net-buttons/js/buttons.html5.mjs";

import Header from "../../../components/Header";
import Sidebar from "../../../components/Sidebar";

import { getInventory } from "../../service/inventoryService";

import "../style.css";

DataTable.use(DtCore);
DtCore.Buttons.jszip(JSZip);

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const formatDate = (value) => {
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

function Inventory() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterTanggalAwal, setFilterTanggalAwal] = useState("");
  const [filterTanggalAkhir, setFilterTanggalAkhir] = useState("");
  const [filterStok, setFilterStok] = useState("semua");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getInventory();
      setData(result);
    } catch (err) {
      setError(err.message || "Gagal mengambil data inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const keyword = search.trim().toLowerCase();

      const cocokNama = String(item.nama_barang || "")
        .toLowerCase()
        .includes(keyword);

      const cocokTanggal =
        (!filterTanggalAwal || item.tanggal >= filterTanggalAwal) &&
        (!filterTanggalAkhir || item.tanggal <= filterTanggalAkhir);

      const stok = Number(item.jumlah) || 0;

      const cocokStok =
        filterStok === "semua" ||
        (filterStok === "tersedia" && stok > 0) ||
        (filterStok === "habis" && stok <= 0);

      return cocokNama && cocokTanggal && cocokStok;
    });
  }, [data, search, filterTanggalAwal, filterTanggalAkhir, filterStok]);

  const totalStok = filteredData.reduce(
    (total, item) => total + (Number(item.jumlah) || 0),
    0
  );

  const totalNilaiPersediaan = filteredData.reduce(
    (total, item) =>
      total +
      (Number(item.jumlah) || 0) * (Number(item.harga) || 0),
    0
  );

  const columns = useMemo(
    () => [
      {
        title: "No.",
        data: null,
        orderable: false,
        searchable: false,
        render: (_value, _type, _row, meta) => meta.row + 1,
      },
      {
        title: "Tanggal",
        data: "tanggal",
        render: (value, type) =>
          type === "display" ? escapeHtml(formatDate(value)) : value || "",
      },
      {
        title: "Nama Barang",
        data: "nama_barang",
        render: (value) => escapeHtml(value),
      },
      {
        title: "Jumlah Stok",
        data: "jumlah",
        className: "dt-center",
        render: (value, type) => {
          const jumlah = Number(value) || 0;

          if (type !== "display") return jumlah;

          const className =
            jumlah > 0 ? "inventory-badge-ada" : "inventory-badge-habis";

          const label = jumlah > 0 ? "Tersedia" : "Habis";

          return `<span class="inventory-stock ${className}">${jumlah} unit · ${label}</span>`;
        },
      },
      {
        title: "Harga Satuan",
        data: "harga",
        className: "dt-right",
        render: (value, type) => {
          const harga = Number(value) || 0;

          return type === "display"
            ? escapeHtml(formatRupiah(harga))
            : harga;
        },
      },
      {
        title: "Nilai Persediaan",
        data: null,
        className: "dt-right",
        render: (_value, type, row) => {
          const total =
            (Number(row.jumlah) || 0) * (Number(row.harga) || 0);

          return type === "display"
            ? escapeHtml(formatRupiah(total))
            : total;
        },
      },
    ],
    []
  );

  const tableOptions = useMemo(
    () => ({
      pageLength: 20,
      lengthMenu: [
        [10, 20, 50, 100],
        [10, 20, 50, 100],
      ],
      ordering: true,
      order: [[1, "desc"]],
      searching: true,
      autoWidth: false,
      scrollX: true,
      language: {
        emptyTable: "Belum ada data inventory.",
        zeroRecords: "Data tidak ditemukan.",
        info: "Menampilkan _START_–_END_ dari _TOTAL_ barang",
        infoEmpty: "Belum ada data",
        infoFiltered: "(difilter dari _MAX_ barang)",
        lengthMenu: "Tampilkan _MENU_ barang",
        search: "Cari:",
        paginate: {
          first: "Awal",
          last: "Akhir",
          next: "Berikutnya",
          previous: "Sebelumnya",
        },
      },
      layout: {
        topStart: {
          buttons: [
            {
              extend: "excelHtml5",
              text: "Export Excel",
              title: "Data Inventory Sicounting",
              exportOptions: {
                columns: [0, 1, 2, 3, 4, 5],
              },
            },
          ],
        },
        topEnd: "search",
        bottomStart: "info",
        bottomEnd: "paging",
      },
    }),
    []
  );

  return (
    <div className="dashboard-page">
      <Sidebar />

      <div className="dashboard-main">
        <Header />

        <main className="dashboard-content">
          <section className="inventory-page">
            <div className="inventory-heading">
              <div>
                <span className="inventory-eyebrow">
                  MANAJEMEN PERSEDIAAN
                </span>

                <h1>Jurnal Inventory</h1>

                <p>
                  Pantau jumlah stok dan nilai persediaan barang usahamu.
                </p>
              </div>
            </div>

            <div className="inventory-summary">
              <article className="inventory-summary-card">
                <span>Jenis Barang</span>
                <strong>{filteredData.length}</strong>
                <small>Jenis barang sesuai filter</small>
              </article>

              <article className="inventory-summary-card">
                <span>Total Stok</span>
                <strong>{totalStok.toLocaleString("id-ID")}</strong>
                <small>Unit barang sesuai filter</small>
              </article>

              <article className="inventory-summary-card">
                <span>Nilai Persediaan</span>
                <strong>{formatRupiah(totalNilaiPersediaan)}</strong>
                <small>Jumlah stok × harga satuan</small>
              </article>
            </div>

            {error && (
              <div
                className="inventory-alert inventory-alert-error"
                role="alert"
              >
                {error}
              </div>
            )}

            <div className="inventory-panel">
              <div className="inventory-panel-heading">
                <div>
                  <h2>Daftar Inventory</h2>
                  <p>
                    Data persediaan barang yang tercatat dari transaksi usaha.
                  </p>
                </div>

                <button
                  type="button"
                  className="inventory-button-secondary"
                  onClick={loadData}
                  disabled={loading}
                >
                  {loading ? "Memuat..." : "Refresh"}
                </button>
              </div>

              <div className="inventory-filters">
                <div className="inventory-field">
                  <label htmlFor="inventory-search">Cari Nama Barang</label>
                  <input
                    id="inventory-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Masukkan nama barang..."
                  />
                </div>

                <div className="inventory-field">
                  <label htmlFor="inventory-filter-awal">
                    Tanggal Mulai
                  </label>
                  <input
                    id="inventory-filter-awal"
                    type="date"
                    value={filterTanggalAwal}
                    onChange={(event) =>
                      setFilterTanggalAwal(event.target.value)
                    }
                  />
                </div>

                <div className="inventory-field">
                  <label htmlFor="inventory-filter-akhir">
                    Tanggal Akhir
                  </label>
                  <input
                    id="inventory-filter-akhir"
                    type="date"
                    min={filterTanggalAwal || undefined}
                    value={filterTanggalAkhir}
                    onChange={(event) =>
                      setFilterTanggalAkhir(event.target.value)
                    }
                  />
                </div>

                <div className="inventory-field">
                  <label htmlFor="inventory-filter-stok">
                    Kondisi Stok
                  </label>

                  <select
                    id="inventory-filter-stok"
                    value={filterStok}
                    onChange={(event) => setFilterStok(event.target.value)}
                  >
                    <option value="semua">Semua Stok</option>
                    <option value="tersedia">Tersedia</option>
                    <option value="habis">Stok Habis</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="inventory-loading">
                  Memuat data inventory...
                </div>
              ) : (
                <div className="inventory-table-wrapper">
                  <DataTable
                    key={`${filterTanggalAwal}-${filterTanggalAkhir}-${filterStok}-${search}`}
                    data={filteredData}
                    columns={columns}
                    options={tableOptions}
                    className="display inventory-table"
                  />
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Inventory;