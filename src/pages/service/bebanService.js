import { supabase } from "../../lib/supabase";

const TABLE = "beban";

export async function getBeban() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function createBeban(payload) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Silakan login terlebih dahulu.");

  // 1. Simpan beban menggunakan kolom database yang tersedia.
  const { data: beban, error: bebanError } = await supabase
    .from(TABLE)
    .insert({
      users_id: user.id,
      tanggal: payload.tanggal,
      keterangan: payload.keterangan,
      nominal: Number(payload.nominal),
      metode_pembayaran: payload.metode_pembayaran,
    })
    .select("*")
    .single();

  if (bebanError) throw bebanError;

  // 2. Jika cash, catat pengeluaran kas.
  if (payload.metode_pembayaran === "cash") {
    const { error: kasError } = await supabase.from("kas").insert({
      user_id: user.id,
      tanggal: payload.tanggal,
      jenis: "pengeluaran",
      nominal: Number(payload.nominal),
      keterangan: `Pembayaran beban: ${payload.keterangan}`,
      beban_id: beban.id,
    });

    if (kasError) {
      // Batalkan insert beban jika insert kas gagal.
      await supabase.from(TABLE).delete().eq("id", beban.id);
      throw kasError;
    }
  }

  // 3. Jika hutang, catat penambahan utang.
  if (payload.metode_pembayaran === "hutang") {
    const { error: utangError } = await supabase.from("utang").insert({
      users_id: user.id,
      beban_id: beban.id,
      tanggal: payload.tanggal,
      jenis_transaksi: "kredit",
      nominal: Number(payload.nominal),
      keterangan: `Utang beban: ${payload.keterangan}`,
    });

    if (utangError) {
      await supabase.from(TABLE).delete().eq("id", beban.id);
      throw utangError;
    }
  }

  return beban;
}

export async function updateBeban(id, payload) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Silakan login terlebih dahulu.");

  const { data: bebanLama, error: cariError } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("users_id", user.id)
    .single();

  if (cariError) throw cariError;

  // Hapus catatan terkait sebelumnya supaya tidak terhitung dua kali.
  const { error: hapusKasError } = await supabase
    .from("kas")
    .delete()
    .eq("beban_id", id)
    .eq("user_id", user.id);

  if (hapusKasError) throw hapusKasError;

  const { error: hapusUtangError } = await supabase
    .from("utang")
    .delete()
    .eq("beban_id", id)
    .eq("users_id", user.id);

  if (hapusUtangError) throw hapusUtangError;

  const { data: beban, error: updateError } = await supabase
    .from(TABLE)
    .update({
      tanggal: payload.tanggal,
      keterangan: payload.keterangan,
      nominal: Number(payload.nominal),
      metode_pembayaran: payload.metode_pembayaran,
    })
    .eq("id", id)
    .eq("users_id", user.id)
    .select("*")
    .single();

  if (updateError) {
    // Upaya memulihkan catatan lama jika update beban gagal.
    await pulihkanRelasiBeban(bebanLama, user.id);
    throw updateError;
  }

  try {
    await buatRelasiBeban(beban, user.id);
  } catch (error) {
    throw new Error(
      `Beban diperbarui, tetapi transaksi kas/utang gagal dibuat: ${error.message}`
    );
  }

  return beban;
}

async function buatRelasiBeban(beban, userId) {
  if (beban.metode_pembayaran === "cash") {
    const { error } = await supabase.from("kas").insert({
      user_id: userId,
      tanggal: beban.tanggal,
      jenis: "pengeluaran",
      nominal: Number(beban.nominal),
      keterangan: `Pembayaran beban: ${beban.keterangan}`,
      beban_id: beban.id,
    });

    if (error) throw error;
  } else if (beban.metode_pembayaran === "hutang") {
    const { error } = await supabase.from("utang").insert({
      users_id: userId,
      beban_id: beban.id,
      tanggal: beban.tanggal,
      jenis_transaksi: "kredit",
      nominal: Number(beban.nominal),
      keterangan: `Utang beban: ${beban.keterangan}`,
    });

    if (error) throw error;
  }
}

async function pulihkanRelasiBeban(beban, userId) {
  if (!beban) return;

  try {
    await buatRelasiBeban(beban, userId);
  } catch (error) {
    console.error("Gagal memulihkan transaksi terkait:", error);
  }
}

export async function deleteBeban(id) {
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("Silakan login terlebih dahulu.");

  // Hapus relasi terlebih dahulu karena tabel lain merujuk beban.
  const { error: kasError } = await supabase
    .from("kas")
    .delete()
    .eq("beban_id", id)
    .eq("user_id", user.id);

  if (kasError) throw kasError;

  const { error: utangError } = await supabase
    .from("utang")
    .delete()
    .eq("beban_id", id)
    .eq("users_id", user.id);

  if (utangError) throw utangError;

  const { error: bebanError } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("users_id", user.id);

  if (bebanError) throw bebanError;

  return true;
}