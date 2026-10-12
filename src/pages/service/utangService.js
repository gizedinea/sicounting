import { supabase } from "../../lib/supabase";

const TABLE_UTANG = "utang";
const TABLE_KAS = "kas";

export const getUtang = async () => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!user) {
    throw new Error("Silakan login terlebih dahulu.");
  }

  const { data, error } = await supabase
    .from(TABLE_UTANG)
    .select("*")
    .eq("users_id", user.id)
    .order("tanggal", { ascending: false });

  if (error) throw error;

  return data || [];
};

export const createUtang = async (payload) => {
  if (!["kredit", "debit"].includes(payload.jenis_transaksi)) {
    throw new Error("Jenis transaksi utang tidak valid.");
  }

  const nominal = Number(payload.nominal);

  if (!Number.isFinite(nominal) || nominal <= 0) {
    throw new Error("Nominal harus lebih besar dari nol.");
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;

  if (!user) {
    throw new Error("Silakan login terlebih dahulu.");
  }

  // Validasi pembayaran sebelum menyimpan transaksi.
  if (payload.jenis_transaksi === "debit") {
    const { data: daftarUtang, error: daftarUtangError } = await supabase
      .from(TABLE_UTANG)
      .select("nominal, jenis_transaksi")
      .eq("users_id", user.id);

    if (daftarUtangError) throw daftarUtangError;

    // Hitung sisa utang:
    // Kredit = menambah utang.
    // Debit = mengurangi utang.
    const totalKredit = (daftarUtang || [])
      .filter((item) => item.jenis_transaksi === "kredit")
      .reduce((total, item) => total + Number(item.nominal || 0), 0);

    const totalDebit = (daftarUtang || [])
      .filter((item) => item.jenis_transaksi === "debit")
      .reduce((total, item) => total + Number(item.nominal || 0), 0);

    const sisaUtang = totalKredit - totalDebit;

    if (nominal > sisaUtang) {
      throw new Error(
        `Pembayaran dibatalkan. Nominal pembayaran ${new Intl.NumberFormat(
          "id-ID",
          {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
          }
        ).format(nominal)} melebihi sisa utang ${new Intl.NumberFormat(
          "id-ID",
          {
            style: "currency",
            currency: "IDR",
            maximumFractionDigits: 0,
          }
        ).format(Math.max(0, sisaUtang))}.`
      );
    }
  }

  // Simpan transaksi ke jurnal utang setelah validasi lolos.
  const { data: utang, error: utangError } = await supabase
    .from(TABLE_UTANG)
    .insert({
      ...payload,
      users_id: user.id,
      nominal,
    })
    .select()
    .single();

  if (utangError) throw utangError;

  // Pembayaran utang dicatat sebagai pengeluaran pada jurnal kas.
  if (utang.jenis_transaksi === "debit") {
    const kasPayload = {
      user_id: user.id,
      nomor_transaksi: `UT-${utang.id}`,
      tanggal: utang.tanggal,
      jenis: "pengeluaran",
      nominal: Number(utang.nominal),
      keterangan: `Pembayaran utang: ${
        utang.keterangan || "Tanpa keterangan"
      }`,
      utang_id: utang.id,
    };

    const { error: kasError } = await supabase
      .from(TABLE_KAS)
      .insert(kasPayload);

    if (kasError) {
      // Batalkan transaksi utang jika pencatatan kas gagal.
      const { error: rollbackError } = await supabase
        .from(TABLE_UTANG)
        .delete()
        .eq("id", utang.id)
        .eq("users_id", user.id);

      if (rollbackError) {
        throw new Error(
          `Pencatatan kas gagal: ${kasError.message}. ` +
            `Pembatalan transaksi utang juga gagal: ${rollbackError.message}`
        );
      }

      throw new Error(
        `Pembayaran belum berhasil dicatat ke kas: ${kasError.message}`
      );
    }
  }

  return utang;
};