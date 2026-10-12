import { supabase } from "../../lib/supabase";

const TABLE = "piutang";
const KAS_TABLE = "kas";

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

export const getPiutang = async () => {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Silakan login terlebih dahulu.");

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("users_id", user.id)
    .order("tanggal", { ascending: false });

  if (error) throw error;

  return data ?? [];
};

export const createPiutang = async (payload) => {
  if (!["kredit", "debit"].includes(payload.jenis_transaksi)) {
    throw new Error("Jenis transaksi piutang tidak valid.");
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
  if (!user) throw new Error("Silakan login terlebih dahulu.");

  // Validasi penerimaan pembayaran sebelum menyimpan transaksi.
  if (payload.jenis_transaksi === "kredit") {
    const { data: daftarPiutang, error: daftarPiutangError } =
      await supabase
        .from(TABLE)
        .select("nominal, jenis_transaksi")
        .eq("users_id", user.id);

    if (daftarPiutangError) throw daftarPiutangError;

    // Debit menambah piutang.
    // Kredit mengurangi piutang karena pelanggan membayar.
    const totalDebit = (daftarPiutang ?? [])
      .filter((item) => item.jenis_transaksi === "debit")
      .reduce((total, item) => total + Number(item.nominal || 0), 0);

    const totalKredit = (daftarPiutang ?? [])
      .filter((item) => item.jenis_transaksi === "kredit")
      .reduce((total, item) => total + Number(item.nominal || 0), 0);

    const sisaPiutang = totalDebit - totalKredit;

    if (nominal > sisaPiutang) {
      throw new Error(
        `Pembayaran dibatalkan. Nominal penerimaan ${formatRupiah(
          nominal
        )} melebihi sisa piutang ${formatRupiah(
          Math.max(0, sisaPiutang)
        )}.`
      );
    }
  }

  // Simpan transaksi piutang setelah validasi lolos.
  const { data: piutangBaru, error: piutangError } = await supabase
    .from(TABLE)
    .insert({
      ...payload,
      users_id: user.id,
      nominal,
    })
    .select()
    .single();

  if (piutangError) throw piutangError;

  // Pembayaran pelanggan menambah kas.
  if (piutangBaru.jenis_transaksi === "kredit") {
    const nomorTransaksi = `PIU-${piutangBaru.id}-${crypto.randomUUID()}`;

    const { error: kasError } = await supabase
      .from(KAS_TABLE)
      .insert({
        user_id: user.id,
        nomor_transaksi: nomorTransaksi,
        tanggal: piutangBaru.tanggal,
        jenis: "pemasukan",
        nominal: Number(piutangBaru.nominal),
        keterangan: `Penerimaan pembayaran piutang: ${
          piutangBaru.keterangan || "Tanpa keterangan"
        }`,
        piutang_id: piutangBaru.id,
      });

    if (kasError) {
      // Batalkan transaksi piutang jika pencatatan kas gagal.
      const { error: rollbackError } = await supabase
        .from(TABLE)
        .delete()
        .eq("id", piutangBaru.id)
        .eq("users_id", user.id);

      if (rollbackError) {
        throw new Error(
          `Pencatatan kas gagal: ${kasError.message}. ` +
            `Pembatalan transaksi piutang juga gagal: ${rollbackError.message}`
        );
      }

      throw new Error(
        `Gagal mencatat penerimaan ke kas: ${kasError.message}`
      );
    }
  }

  return piutangBaru;
};