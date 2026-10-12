
import { supabase } from "../../lib/supabase";

const TABLE = "inventory";

// Mengambil seluruh data inventory.
export const getInventory = async () => {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("tanggal", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Gagal mengambil data inventory:", error);
    throw error;
  }

  return data ?? [];
};

// Menambahkan barang baru ke inventory.
export const createInventory = async (payload) => {
  const databasePayload = {
    users_id: payload.users_id,
    tanggal: payload.tanggal,
    nama_barang: payload.nama_barang,
    jumlah: Number(payload.jumlah),
    harga: Number(payload.harga),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .insert(databasePayload)
    .select("*")
    .single();

  if (error) {
    console.error("Gagal menambahkan inventory:", error);
    throw error;
  }

  return data;
};

// Memperbarui data inventory.
export const updateInventory = async (id, payload) => {
  const databasePayload = {
    tanggal: payload.tanggal,
    nama_barang: payload.nama_barang,
    jumlah: Number(payload.jumlah),
    harga: Number(payload.harga),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .update(databasePayload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("Gagal memperbarui inventory:", error);
    throw error;
  }

  return data;
};

// Menghapus barang dari inventory.
export const deleteInventory = async (id) => {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Gagal menghapus inventory:", error);
    throw error;
  }

  return true;
};
