"use server";

import { revalidatePath } from "next/cache";

import { attempt } from "@/lib/action-result";
import { requireUser } from "@/lib/auth/session";
import {
  attachConsultantToProject,
  createConsultant,
  deleteConsultant,
  detachConsultantFromProject,
  updateConsultant,
} from "@/lib/db/repo";

function revalidateConsultantPaths(projectId?: string) {
  revalidatePath("/consultants");
  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath("/customers");
  if (projectId) {
    // board sheet uses list data; path refresh covers it
  }
}

export async function createConsultantAction(input: {
  name: string;
  company?: string | null;
  discipline?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}) {
  return attempt(async () => {
    await requireUser();
    if (!input.name.trim()) throw new Error("Name is required.");
    const consultant = await createConsultant({
      name: input.name.trim(),
      company: input.company?.trim() || null,
      discipline: input.discipline?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
    });
    revalidateConsultantPaths();
    return consultant;
  });
}

/** Create a consultant and attach them to a project in one step. */
export async function createAndAttachConsultantAction(
  projectId: string,
  input: {
    name: string;
    company?: string | null;
    discipline?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  },
) {
  return attempt(async () => {
    const user = await requireUser();
    if (!input.name.trim()) throw new Error("Name is required.");
    const consultant = await createConsultant({
      name: input.name.trim(),
      company: input.company?.trim() || null,
      discipline: input.discipline?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      notes: input.notes?.trim() || null,
    });
    const project = await attachConsultantToProject(
      projectId,
      consultant.id,
      user.id,
    );
    revalidateConsultantPaths(projectId);
    return { consultant, project };
  });
}

export async function updateConsultantAction(
  id: string,
  patch: {
    name?: string;
    company?: string | null;
    discipline?: string | null;
    email?: string | null;
    phone?: string | null;
    notes?: string | null;
  },
) {
  return attempt(async () => {
    await requireUser();
    const consultant = await updateConsultant(id, patch);
    revalidatePath(`/consultants/${id}`);
    revalidateConsultantPaths();
    return consultant;
  });
}

export async function deleteConsultantAction(id: string) {
  await requireUser();
  try {
    await deleteConsultant(id);
    revalidateConsultantPaths();
    return { ok: true as const };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Delete failed",
    };
  }
}

export async function attachConsultantAction(
  projectId: string,
  consultantId: string,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await attachConsultantToProject(
      projectId,
      consultantId,
      user.id,
    );
    revalidateConsultantPaths(projectId);
    return project;
  });
}

export async function detachConsultantAction(
  projectId: string,
  consultantId: string,
) {
  return attempt(async () => {
    const user = await requireUser();
    const project = await detachConsultantFromProject(
      projectId,
      consultantId,
      user.id,
    );
    revalidateConsultantPaths(projectId);
    return project;
  });
}
