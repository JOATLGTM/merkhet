"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import {
  createCustomer,
  deleteCustomer,
  updateCustomer,
} from "@/lib/db/repo";

export async function createCustomerAction(input: {
  name: string;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  spouse_name?: string | null;
  notes?: string | null;
}) {
  await requireUser();
  const customer = await createCustomer({
    name: input.name,
    contact_name: input.contact_name ?? null,
    contact_email: input.contact_email ?? null,
    contact_phone: input.contact_phone ?? null,
    spouse_name: input.spouse_name ?? null,
    notes: input.notes ?? null,
  });
  revalidatePath("/customers");
  // The board's New Project dialog can create customers too, so the board's
  // own customer list (and the nav rail count) has to pick them up as well.
  revalidatePath("/");
  return customer;
}

export async function updateCustomerAction(
  id: string,
  patch: {
    name?: string;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    spouse_name?: string | null;
    notes?: string | null;
  },
) {
  await requireUser();
  const customer = await updateCustomer(id, patch);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  revalidatePath("/");
  return customer;
}

export async function deleteCustomerAction(id: string) {
  await requireUser();
  try {
    await deleteCustomer(id);
    revalidatePath("/customers");
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}
