
import { supabase } from "../../lib/supabase";

const TABLE_PEMBELIAN = "pembelian";
const TABLE_KAS = "kas";
const TABLE_UTANG = "utang";
const TABLE_INVENTORY = "inventory";

const hitungTotal = (item) =>
  Number(item.harga || 0) * Number(item.jumlah || 0);

const mapPembelian = (item) => ({
  ...item,
  nomor_transaksi: item.no_penjualan,
});

const mapPayloadPembelian = (payload, includeUser = false) => {
  const result = {
    tanggal: payload.tanggal,
    nama_barang: payload.nama_barang,
    jumlah: Number(payload.jumlah),
    harga: Number(payload.harga),
    metode_pembayaran: payload.metode_pembayaran,
    no_penjualan:
      payload.nomor_transaksi ?? payload.no_penjualan ?? null,
  };

  if (includeUser) {
    result.users_id = payload.users_id;
  }

  return result;
};

const ambilUserId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Silakan login terlebih dahulu.");

  return user.id;
};

const hapusRelasiPembelian = async (pembelianId) => {
  for (const table of [TABLE_KAS, TABLE_UTANG, TABLE_INVENTORY]) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("pembelian_id", pembelianId);

    if (error) {
      throw new Error(
        `Gagal menghapus data ${table}: ${error.message}`
      );
    }
  }
};

// ========================================
// INVENTORY
// Satu baris stok untuk setiap nama barang.
// Pembelian baru menambah stok yang sudah ada.
// ========================================
const sinkronkanInventory = async (pembelian, userId) => {
  const namaBarang = String(pembelian.nama_barang || "").trim();

  if (!namaBarang) {
    throw new Error("Nama barang tidak boleh kosong.");
  }

  // Cari catatan inventory yang sebelumnya dibuat
  // khusus untuk transaksi pembelian ini.
  const { data: inventoryTransaksi, error: errorTransaksi } =
    await supabase
      .from(TABLE_INVENTORY)
      .select("*")
      .eq("pembelian_id", pembelian.id)
      .eq("users_id", userId);

  if (errorTransaksi) throw errorTransaksi;

  const payload = {
    users_id: userId,
    tanggal: pembelian.tanggal,
    nama_barang: namaBarang,
    jumlah: Number(pembelian.jumlah),
    harga: Number(pembelian.harga),
  };

  // Edit transaksi: jangan menambah stok dua kali.
  if (inventoryTransaksi?.length) {
    const { error } = await supabase
      .from(TABLE_INVENTORY)
      .update(payload)
      .eq("pembelian_id", pembelian.id)
      .eq("users_id", userId);

    if (error) throw error;
    return;
  }

  // Cari barang yang sama di inventory.
  const { data: semuaBarang, error: errorBarang } = await supabase
    .from(TABLE_INVENTORY)
    .select("*")
    .eq("users_id", userId)
    .ilike("nama_barang", namaBarang)
    .order("id", { ascending: true });

  if (errorBarang) throw errorBarang;

  if (semuaBarang?.length) {
    // Pertahankan satu baris inventory sebagai stok utama.
    const stokUtama = semuaBarang[0];

    // Jika sudah ada baris duplikat lama, gabungkan jumlahnya
    // ke baris utama lalu hapus baris duplikat tersebut.
    const stokSebelum = semuaBarang.reduce(
      (total, item) => total + Number(item.jumlah || 0),
      0
    );

    const { error: updateError } = await supabase
      .from(TABLE_INVENTORY)
      .update({
        tanggal: pembelian.tanggal,
        jumlah: stokSebelum + Number(pembelian.jumlah),
        harga: Number(pembelian.harga),
        pembelian_id: null,
      })
      .eq("id", stokUtama.id)
      .eq("users_id", userId);

    if (updateError) throw updateError;

    const idDuplikat = semuaBarang
      .slice(1)
      .map((item) => item.id);

    if (idDuplikat.length) {
      const { error: deleteError } = await supabase
        .from(TABLE_INVENTORY)
        .delete()
        .in("id", idDuplikat)
        .eq("users_id", userId);

      if (deleteError) throw deleteError;
    }
  } else {
    // Barang benar-benar baru.
    const { error: insertError } = await supabase
      .from(TABLE_INVENTORY)
      .insert({
        ...payload,
        pembelian_id: null,
      });

    if (insertError) throw insertError;
  }
};

// ========================================
// KAS
// Langsung = pengeluaran.
// Nanti = tidak mengurangi kas.
// ========================================
const sinkronkanKas = async (pembelian, userId) => {
  const { data: kasLama, error } = await supabase
    .from(TABLE_KAS)
    .select("id")
    .eq("pembelian_id", pembelian.id)
    .eq("user_id", userId);

  if (error) throw error;

  if (pembelian.metode_pembayaran === "langsung") {
    const payload = {
      user_id: userId,
      pembelian_id: pembelian.id,
      nomor_transaksi: `K-P-${pembelian.id}`,
      tanggal: pembelian.tanggal,
      jenis: "pengeluaran",
      nominal: hitungTotal(pembelian),
      keterangan: `Pembelian ${pembelian.nama_barang}`,
    };

    if (kasLama?.length) {
      const { error: updateError } = await supabase
        .from(TABLE_KAS)
        .update({
          tanggal: payload.tanggal,
          jenis: payload.jenis,
          nominal: payload.nominal,
          keterangan: payload.keterangan,
        })
        .eq("pembelian_id", pembelian.id)
        .eq("user_id", userId);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from(TABLE_KAS)
        .insert(payload);

      if (insertError) throw insertError;
    }
  } else {
    const { error: deleteError } = await supabase
      .from(TABLE_KAS)
      .delete()
      .eq("pembelian_id", pembelian.id)
      .eq("user_id", userId);

    if (deleteError) throw deleteError;
  }
};

// ========================================
// UTANG
// Nanti = kredit utang.
// Langsung = tidak ada utang pembelian.
// ========================================
const sinkronkanUtang = async (pembelian, userId) => {
  const { data: utangLama, error } = await supabase
    .from(TABLE_UTANG)
    .select("id")
    .eq("pembelian_id", pembelian.id)
    .eq("users_id", userId);

  if (error) throw error;

  if (pembelian.metode_pembayaran === "nanti") {
    const payload = {
      users_id: userId,
      pembelian_id: pembelian.id,
      tanggal: pembelian.tanggal,
      jenis_transaksi: "kredit",
      nominal: hitungTotal(pembelian),
      keterangan: `Utang pembelian ${pembelian.nama_barang}`,
    };

    if (utangLama?.length) {
      const { error: updateError } = await supabase
        .from(TABLE_UTANG)
        .update({
          tanggal: payload.tanggal,
          jenis_transaksi: payload.jenis_transaksi,
          nominal: payload.nominal,
          keterangan: payload.keterangan,
        })
        .eq("pembelian_id", pembelian.id)
        .eq("users_id", userId);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from(TABLE_UTANG)
        .insert(payload);

      if (insertError) throw insertError;
    }
  } else {
    const { error: deleteError } = await supabase
      .from(TABLE_UTANG)
      .delete()
      .eq("pembelian_id", pembelian.id)
      .eq("users_id", userId);

    if (deleteError) throw deleteError;
  }
};

const sinkronkanRelasi = async (pembelian, userId) => {
  await sinkronkanInventory(pembelian, userId);
  await sinkronkanKas(pembelian, userId);
  await sinkronkanUtang(pembelian, userId);
};

// ========================================
// GET PEMBELIAN
// ========================================
export const getPembelian = async () => {
  const userId = await ambilUserId();

  const { data, error } = await supabase
    .from(TABLE_PEMBELIAN)
    .select("*")
    .eq("users_id", userId)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapPembelian);
};

// ========================================
// GET INVENTORY
// Menggabungkan nama barang yang sama.
// ========================================
export const getBarangInventory = async () => {
  const userId = await ambilUserId();

  const { data, error } = await supabase
    .from(TABLE_INVENTORY)
    .select("nama_barang, jumlah, harga")
    .eq("users_id", userId)
    .order("nama_barang", { ascending: true });

  if (error) throw error;

  const daftarBarang = new Map();

  for (const item of data ?? []) {
    const nama = String(item.nama_barang || "").trim();
    if (!nama) continue;

    const key = nama.toLocaleLowerCase("id-ID");

    if (!daftarBarang.has(key)) {
      daftarBarang.set(key, {
        nama_barang: nama,
        stok: 0,
        harga: Number(item.harga || 0),
      });
    }

    const barang = daftarBarang.get(key);
    barang.stok += Number(item.jumlah || 0);
    barang.harga = Number(item.harga || barang.harga);
  }

  return [...daftarBarang.values()].sort((a, b) =>
    a.nama_barang.localeCompare(b.nama_barang, "id")
  );
};

// ========================================
// CREATE PEMBELIAN
// ========================================
export const createPembelian = async (payload) => {
  const userId = payload.users_id || (await ambilUserId());

  const databasePayload = mapPayloadPembelian(
    { ...payload, users_id: userId },
    true
  );

  const { data, error } = await supabase
    .from(TABLE_PEMBELIAN)
    .insert(databasePayload)
    .select("*")
    .single();

  if (error) throw error;

  try {
    await sinkronkanRelasi(data, userId);
  } catch (syncError) {
    console.error("Sinkronisasi pembelian gagal:", syncError);

    // Hapus hanya relasi milik transaksi yang baru dibuat.
    try {
      await supabase
        .from(TABLE_KAS)
        .delete()
        .eq("pembelian_id", data.id)
        .eq("user_id", userId);

      await supabase
        .from(TABLE_UTANG)
        .delete()
        .eq("pembelian_id", data.id)
        .eq("users_id", userId);

      // Jangan hapus stok utama di sini, sebab stok tersebut
      // mungkin sudah berisi jumlah dari transaksi sebelumnya.
      await supabase
        .from(TABLE_PEMBELIAN)
        .delete()
        .eq("id", data.id)
        .eq("users_id", userId);
    } catch (cleanupError) {
      console.error("Pembersihan gagal:", cleanupError);
    }

    throw new Error(
      `Pembelian gagal disinkronkan: ${syncError.message}`
    );
  }

  return mapPembelian(data);
};

// ========================================
// UPDATE PEMBELIAN
// ========================================
export const updatePembelian = async (id, payload) => {
  const userId = await ambilUserId();

  const { data: lama, error: lamaError } = await supabase
    .from(TABLE_PEMBELIAN)
    .select("*")
    .eq("id", id)
    .eq("users_id", userId)
    .single();

  if (lamaError) throw lamaError;

  const databasePayload = mapPayloadPembelian(payload, false);

  const { data, error } = await supabase
    .from(TABLE_PEMBELIAN)
    .update(databasePayload)
    .eq("id", id)
    .eq("users_id", userId)
    .select("*")
    .single();

  if (error) throw error;

  try {
    // Jangan menambah stok lagi saat edit.
    // sinkronkanInventory memperbarui transaksi yang terhubung.
    await sinkronkanRelasi(data, userId);
  } catch (syncError) {
    console.error("Sinkronisasi perubahan gagal:", syncError);

    const { error: rollbackError } = await supabase
      .from(TABLE_PEMBELIAN)
      .update({
        tanggal: lama.tanggal,
        nama_barang: lama.nama_barang,
        jumlah: lama.jumlah,
        harga: lama.harga,
        metode_pembayaran: lama.metode_pembayaran,
        no_penjualan: lama.no_penjualan,
      })
      .eq("id", id)
      .eq("users_id", userId);

    if (rollbackError) {
      console.error("Rollback gagal:", rollbackError);
    }

    throw new Error(
      `Perubahan gagal disinkronkan: ${syncError.message}`
    );
  }

  return mapPembelian(data);
};

// ========================================
// DELETE PEMBELIAN
// ========================================
export const deletePembelian = async (id) => {
  const userId = await ambilUserId();

  const { data: pembelian, error: cekError } = await supabase
    .from(TABLE_PEMBELIAN)
    .select("*")
    .eq("id", id)
    .eq("users_id", userId)
    .single();

  if (cekError) throw cekError;
  if (!pembelian) {
    throw new Error("Data pembelian tidak ditemukan.");
  }

  // Hapus transaksi terkait dari kas dan utang.
  for (const table of [TABLE_KAS, TABLE_UTANG]) {
    const kolomUser = table === TABLE_KAS ? "user_id" : "users_id";

    const { error } = await supabase
      .from(table)
      .delete()
      .eq("pembelian_id", id)
      .eq(kolomUser, userId);

    if (error) throw error;
  }

  // Kembalikan stok dengan mengurangi jumlah pembelian yang dihapus.
  const { data: barangInventory, error: inventoryError } =
    await supabase
      .from(TABLE_INVENTORY)
      .select("*")
      .eq("users_id", userId)
      .ilike("nama_barang", pembelian.nama_barang)
      .is("pembelian_id", null)
      .order("id", { ascending: true })
      .limit(1);

  if (inventoryError) throw inventoryError;

  if (barangInventory?.length) {
    const barang = barangInventory[0];
    const stokBaru =
      Number(barang.jumlah || 0) - Number(pembelian.jumlah || 0);

    if (stokBaru > 0) {
      const { error } = await supabase
        .from(TABLE_INVENTORY)
        .update({ jumlah: stokBaru })
        .eq("id", barang.id)
        .eq("users_id", userId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(TABLE_INVENTORY)
        .delete()
        .eq("id", barang.id)
        .eq("users_id", userId);

      if (error) throw error;
    }
  }

  const { error: hapusPembelianError } = await supabase
    .from(TABLE_PEMBELIAN)
    .delete()
    .eq("id", id)
    .eq("users_id", userId);

  if (hapusPembelianError) throw hapusPembelianError;
};
