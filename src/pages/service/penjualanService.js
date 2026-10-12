import { supabase } from "../../lib/supabase";

const TABLE_PENJUALAN = "penjualan";
const TABLE_INVENTORY = "inventory";
const TABLE_KAS = "kas";
const TABLE_PIUTANG = "piutang";

const hitungTotal = (item) =>
  Number(item.harga || 0) * Number(item.jumlah || 0);

const ambilUserId = async () => {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw error;
  if (!user) throw new Error("Silakan login terlebih dahulu.");

  return user.id;
};

const namaSama = (a, b) =>
  String(a || "").trim().toLocaleLowerCase("id-ID") ===
  String(b || "").trim().toLocaleLowerCase("id-ID");

// Ambil stok Inventory milik pengguna.
const ambilBarisInventory = async (namaBarang, userId) => {
  const { data, error } = await supabase
    .from(TABLE_INVENTORY)
    .select("id, nama_barang, jumlah, harga")
    .eq("users_id", userId)
    .ilike("nama_barang", namaBarang.trim())
    .order("id", { ascending: true });

  if (error) throw error;

  return (data || []).filter((item) =>
    namaSama(item.nama_barang, namaBarang)
  );
};

// Ubah stok Inventory.
// Delta negatif = stok berkurang.
// Delta positif = stok bertambah.
const ubahStok = async (namaBarang, delta, userId) => {
  const jumlahPerubahan = Number(delta);

  if (!jumlahPerubahan) return;

  const daftar = await ambilBarisInventory(namaBarang, userId);

  if (!daftar.length) {
    throw new Error(
      `Barang "${namaBarang}" tidak ditemukan di Inventory.`
    );
  }

  const stokTotal = daftar.reduce(
    (total, item) => total + Number(item.jumlah || 0),
    0
  );

  if (stokTotal + jumlahPerubahan < 0) {
    throw new Error(
      `Stok ${namaBarang} tidak mencukupi. Stok tersedia: ${stokTotal}.`
    );
  }

  if (jumlahPerubahan > 0) {
    const barang = daftar[0];

    const { error } = await supabase
      .from(TABLE_INVENTORY)
      .update({
        jumlah: Number(barang.jumlah || 0) + jumlahPerubahan,
      })
      .eq("id", barang.id)
      .eq("users_id", userId);

    if (error) throw error;

    return;
  }

  let sisa = Math.abs(jumlahPerubahan);

  for (const barang of daftar) {
    if (sisa <= 0) break;

    const stok = Number(barang.jumlah || 0);
    const dikurangi = Math.min(Math.max(stok, 0), sisa);

    if (dikurangi <= 0) continue;

    const { error } = await supabase
      .from(TABLE_INVENTORY)
      .update({
        jumlah: stok - dikurangi,
      })
      .eq("id", barang.id)
      .eq("users_id", userId);

    if (error) throw error;

    sisa -= dikurangi;
  }

  if (sisa > 0) {
    throw new Error("Stok gagal diperbarui secara lengkap.");
  }
};

// Ambil daftar barang untuk formulir penjualan.
export const getBarangInventory = async () => {
  const userId = await ambilUserId();

  const { data, error } = await supabase
    .from(TABLE_INVENTORY)
    .select("nama_barang, jumlah, harga")
    .eq("users_id", userId)
    .order("nama_barang", { ascending: true });

  if (error) throw error;

  const map = new Map();

  for (const item of data || []) {
    const nama = String(item.nama_barang || "").trim();

    if (!nama) continue;

    const key = nama.toLocaleLowerCase("id-ID");

    if (!map.has(key)) {
      map.set(key, {
        nama_barang: nama,
        stok: 0,
        harga: Number(item.harga || 0),
      });
    }

    const barang = map.get(key);

    barang.stok += Number(item.jumlah || 0);

    if (Number(item.harga || 0) > 0) {
      barang.harga = Number(item.harga);
    }
  }

  return [...map.values()].sort((a, b) =>
    a.nama_barang.localeCompare(b.nama_barang, "id")
  );
};

// Ambil jurnal penjualan pengguna yang sedang login.
export const getPenjualan = async () => {
  const userId = await ambilUserId();

  const { data, error } = await supabase
    .from(TABLE_PENJUALAN)
    .select("*")
    .eq("users_id", userId)
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data || [];
};

// Sinkronisasi transaksi penjualan ke Kas atau Piutang.
const sinkronkanPembayaran = async (penjualan, userId) => {
  const total = hitungTotal(penjualan);

  if (penjualan.metode_pembayaran === "langsung") {
    // Hapus piutang jika pembayaran diubah menjadi langsung.
    const { error: hapusPiutangError } = await supabase
      .from(TABLE_PIUTANG)
      .delete()
      .eq("penjualan_id", penjualan.id)
      .eq("users_id", userId);

    if (hapusPiutangError) throw hapusPiutangError;

    // Periksa apakah transaksi Kas sudah tersedia.
    const { data: kasLama, error: kasError } = await supabase
      .from(TABLE_KAS)
      .select("id")
      .eq("penjualan_id", penjualan.id)
      .eq("user_id", userId);

    if (kasError) throw kasError;

    const payloadKas = {
      user_id: userId,
      penjualan_id: penjualan.id,
      nomor_transaksi: `K-J-${penjualan.id}`,
      tanggal: penjualan.tanggal,
      jenis: "pemasukan",
      nominal: total,
      keterangan: `Penjualan ${penjualan.nama_barang}`,
    };

    if (kasLama?.length) {
      const { error } = await supabase
        .from(TABLE_KAS)
        .update({
          tanggal: payloadKas.tanggal,
          jenis: payloadKas.jenis,
          nominal: payloadKas.nominal,
          keterangan: payloadKas.keterangan,
        })
        .eq("penjualan_id", penjualan.id)
        .eq("user_id", userId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(TABLE_KAS)
        .insert(payloadKas);

      if (error) throw error;
    }

    return;
  }

  if (penjualan.metode_pembayaran === "nanti") {
    // Hapus Kas karena pelanggan belum membayar.
    const { error: hapusKasError } = await supabase
      .from(TABLE_KAS)
      .delete()
      .eq("penjualan_id", penjualan.id)
      .eq("user_id", userId);

    if (hapusKasError) throw hapusKasError;

    // Periksa apakah Piutang dari penjualan ini sudah tersedia.
    const { data: piutangLama, error: piutangError } =
      await supabase
        .from(TABLE_PIUTANG)
        .select("id")
        .eq("penjualan_id", penjualan.id)
        .eq("users_id", userId);

    if (piutangError) throw piutangError;

    const payloadPiutang = {
      users_id: userId,
      penjualan_id: penjualan.id,
      tanggal: penjualan.tanggal,

      // debit = Penambahan Piutang.
      jenis_transaksi: "debit",

      nominal: total,
      keterangan: `Piutang penjualan ${penjualan.nama_barang}`,
    };

    if (piutangLama?.length) {
      const { error } = await supabase
        .from(TABLE_PIUTANG)
        .update({
          tanggal: payloadPiutang.tanggal,
          jenis_transaksi: payloadPiutang.jenis_transaksi,
          nominal: payloadPiutang.nominal,
          keterangan: payloadPiutang.keterangan,
        })
        .eq("penjualan_id", penjualan.id)
        .eq("users_id", userId);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from(TABLE_PIUTANG)
        .insert(payloadPiutang);

      if (error) throw error;
    }

    return;
  }

  throw new Error("Metode pembayaran tidak valid.");
};

// Tambah penjualan.
export const createPenjualan = async (payload) => {
  const userId = await ambilUserId();

  const dataPenjualan = {
    ...payload,
    users_id: userId,
    nama_barang: String(payload.nama_barang || "").trim(),
    jumlah: Number(payload.jumlah),
    harga: Number(payload.harga),
  };

  if (!dataPenjualan.nama_barang) {
    throw new Error("Silakan pilih barang dari Inventory.");
  }

  if (
    !Number.isInteger(dataPenjualan.jumlah) ||
    dataPenjualan.jumlah <= 0
  ) {
    throw new Error(
      "Jumlah penjualan harus berupa bilangan bulat positif."
    );
  }

  if (
    !Number.isFinite(dataPenjualan.harga) ||
    dataPenjualan.harga <= 0
  ) {
    throw new Error("Harga jual harus lebih besar dari nol.");
  }

  // Kurangi stok sebelum menyimpan penjualan.
  await ubahStok(
    dataPenjualan.nama_barang,
    -dataPenjualan.jumlah,
    userId
  );

  let dataTersimpan;

  try {
    const { data, error } = await supabase
      .from(TABLE_PENJUALAN)
      .insert(dataPenjualan)
      .select("*")
      .single();

    if (error) throw error;

    dataTersimpan = data;

    // Catat pemasukan Kas atau penambahan Piutang.
    await sinkronkanPembayaran(data, userId);

    return data;
  } catch (error) {
    // Bersihkan data terkait jika sinkronisasi gagal.
    if (dataTersimpan) {
      await supabase
        .from(TABLE_KAS)
        .delete()
        .eq("penjualan_id", dataTersimpan.id)
        .eq("user_id", userId);

      await supabase
        .from(TABLE_PIUTANG)
        .delete()
        .eq("penjualan_id", dataTersimpan.id)
        .eq("users_id", userId);

      await supabase
        .from(TABLE_PENJUALAN)
        .delete()
        .eq("id", dataTersimpan.id)
        .eq("users_id", userId);
    }

    try {
      await ubahStok(
        dataPenjualan.nama_barang,
        dataPenjualan.jumlah,
        userId
      );
    } catch (rollbackError) {
      console.error("Pengembalian stok gagal:", rollbackError);
    }

    throw error;
  }
};

// Edit penjualan dan sinkronkan kembali Kas atau Piutang.
export const updatePenjualan = async (id, payload) => {
  const userId = await ambilUserId();

  const { data: lama, error: lamaError } = await supabase
    .from(TABLE_PENJUALAN)
    .select("*")
    .eq("id", id)
    .eq("users_id", userId)
    .single();

  if (lamaError) throw lamaError;

  const baru = {
    ...payload,
    users_id: userId,
    nama_barang: String(payload.nama_barang || "").trim(),
    jumlah: Number(payload.jumlah),
    harga: Number(payload.harga),
  };

  if (!baru.nama_barang) {
    throw new Error("Silakan pilih barang dari Inventory.");
  }

  if (!Number.isInteger(baru.jumlah) || baru.jumlah <= 0) {
    throw new Error("Jumlah penjualan tidak valid.");
  }

  if (!Number.isFinite(baru.harga) || baru.harga <= 0) {
    throw new Error("Harga jual tidak valid.");
  }

  // Kembalikan stok transaksi lama.
  await ubahStok(lama.nama_barang, Number(lama.jumlah), userId);

  try {
    // Kurangi stok berdasarkan transaksi terbaru.
    await ubahStok(baru.nama_barang, -baru.jumlah, userId);

    const { data, error } = await supabase
      .from(TABLE_PENJUALAN)
      .update({
        no_penjualan: baru.no_penjualan,
        tanggal: baru.tanggal,
        nama_barang: baru.nama_barang,
        jumlah: baru.jumlah,
        harga: baru.harga,
        metode_pembayaran: baru.metode_pembayaran,
      })
      .eq("id", id)
      .eq("users_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    // Perbarui nominal dan jenis pencatatan.
    await sinkronkanPembayaran(data, userId);

    return data;
  } catch (error) {
    // Upayakan mengembalikan stok dan data penjualan lama.
    try {
      const barangBerubah = !namaSama(
        lama.nama_barang,
        baru.nama_barang
      );

      if (barangBerubah) {
        await ubahStok(baru.nama_barang, baru.jumlah, userId);
      } else {
        await ubahStok(
          baru.nama_barang,
          baru.jumlah - Number(lama.jumlah),
          userId
        );
      }

      await supabase
        .from(TABLE_PENJUALAN)
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
    } catch (rollbackError) {
      console.error(
        "Rollback edit penjualan gagal:",
        rollbackError
      );
    }

    throw error;
  }
};

// Hapus penjualan dan kembalikan stok.
export const deletePenjualan = async (id) => {
  const userId = await ambilUserId();

  const { data: penjualan, error: cariError } = await supabase
    .from(TABLE_PENJUALAN)
    .select("*")
    .eq("id", id)
    .eq("users_id", userId)
    .single();

  if (cariError) throw cariError;

  // Kembalikan stok barang.
  await ubahStok(
    penjualan.nama_barang,
    Number(penjualan.jumlah),
    userId
  );

  try {
    const { error: kasError } = await supabase
      .from(TABLE_KAS)
      .delete()
      .eq("penjualan_id", id)
      .eq("user_id", userId);

    if (kasError) throw kasError;

    const { error: piutangError } = await supabase
      .from(TABLE_PIUTANG)
      .delete()
      .eq("penjualan_id", id)
      .eq("users_id", userId);

    if (piutangError) throw piutangError;

    const { error: hapusError } = await supabase
      .from(TABLE_PENJUALAN)
      .delete()
      .eq("id", id)
      .eq("users_id", userId);

    if (hapusError) throw hapusError;
  } catch (error) {
    try {
      await ubahStok(
        penjualan.nama_barang,
        -Number(penjualan.jumlah),
        userId
      );
    } catch (rollbackError) {
      console.error(
        "Rollback hapus penjualan gagal:",
        rollbackError
      );
    }

    throw error;
  }
};