
import { supabase } from "../../lib/supabase";

const TABLE = "kas";

/**
 * Ubah data database ke format yang digunakan JSX.
 * Database: jenis
 * JSX:      jenis_transaksi
 */
function mapKas(item) {
  if (!item) return item;

  const { jenis, ...rest } = item;

  return {
    ...rest,
    jenis,
    jenis_transaksi: jenis,
  };
}

/**
 * Pastikan payload yang dikirim ke Supabase
 * hanya menggunakan nama kolom database.
 */
function mapPayload(payload) {
  const {
    jenis_transaksi,
    jenis,
    ...rest
  } = payload;

  return {
    ...rest,
    jenis: jenis_transaksi ?? jenis,
  };
}

/**
 * Ambil data jurnal kas.
 */
export async function getKas() {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal mengambil jurnal kas:", error);
    throw error;
  }

  return (data ?? []).map(mapKas);
}

/**
 * Tambah transaksi kas.
 */
export async function createKas(payload) {
  const databasePayload = mapPayload(payload);

  // Jangan kirim properti frontend yang bukan kolom database.
  if ("jenis_transaksi" in databasePayload) {
    delete databasePayload.jenis_transaksi;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(databasePayload)
    .select("*")
    .single();

  if (error) {
    console.error("Gagal menambahkan jurnal kas:", error);
    throw error;
  }

  return mapKas(data);
}

/**
 * Edit transaksi kas.
 */
export async function updateKas(id, payload) {
  const databasePayload = mapPayload(payload);

  if ("jenis_transaksi" in databasePayload) {
    delete databasePayload.jenis_transaksi;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(databasePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Gagal memperbarui jurnal kas:", error);
    throw error;
  }

  return mapKas(data);
}

/**
 * Hapus transaksi kas.
 */
export async function deleteKas(id) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Gagal menghapus jurnal kas:", error);
    throw error;
  }
}
