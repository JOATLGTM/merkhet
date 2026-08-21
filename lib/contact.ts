import type { Customer, Project } from "@/lib/types";

/**
 * Where a project's address and contact details come from.
 *
 * A project is usually reached at the customer's own address and phone, but
 * often enough it is not — a second home, a site contact, a builder, a spouse.
 * So each of the four fields is stored on the project and **null means "same
 * as the customer"**, resolved per field.
 *
 * There is no `uses_customer_contact` flag. A stored boolean can disagree with
 * the rows it describes, and it would have to be all-or-nothing, while in
 * practice a project can carry its own address and still ring through to the
 * customer's phone. Derived rather than stored, the same call delegation
 * completeness makes (`SLICE_4_SCOPE.md` decision 4).
 *
 * React-free so `npm run check:contact` can exercise the fallback headlessly.
 */

export const CONTACT_FIELDS = [
  "address",
  "contact_name",
  "contact_email",
  "contact_phone",
] as const;

export type ContactField = (typeof CONTACT_FIELDS)[number];

/** The `projects` column backing each customer field. */
export const PROJECT_CONTACT_COLUMN = {
  address: "project_address",
  contact_name: "project_contact_name",
  contact_email: "project_contact_email",
  contact_phone: "project_contact_phone",
} as const satisfies Record<ContactField, keyof Project>;

export const CONTACT_LABELS: Record<ContactField, string> = {
  address: "Address",
  contact_name: "Contact",
  contact_email: "Email",
  contact_phone: "Phone",
};

export type ResolvedField = {
  field: ContactField;
  /** What to show. Null when neither the project nor the customer has one. */
  value: string | null;
  /** True when the project overrides rather than inherits this field. */
  overridden: boolean;
  /** The customer's value, so the UI can show what an override replaced. */
  inherited: string | null;
};

type ContactSource = Pick<
  Project,
  | "project_address"
  | "project_contact_name"
  | "project_contact_email"
  | "project_contact_phone"
>;

type CustomerSource = Pick<
  Customer,
  "address" | "contact_name" | "contact_email" | "contact_phone"
>;

/** Blank strings are an empty form field, not a deliberate override. */
function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveContactField(
  field: ContactField,
  project: ContactSource,
  customer: CustomerSource,
): ResolvedField {
  const own = clean(project[PROJECT_CONTACT_COLUMN[field]]);
  const inherited = clean(customer[field]);
  return {
    field,
    value: own ?? inherited,
    overridden: own != null,
    inherited,
  };
}

export function resolveContact(
  project: ContactSource,
  customer: CustomerSource,
): ResolvedField[] {
  return CONTACT_FIELDS.map((field) =>
    resolveContactField(field, project, customer),
  );
}

/**
 * True when the project carries none of its own details — i.e. "same as the
 * customer" in full. Drives the toggle's position, and derived from the rows
 * so it cannot fall out of step with them.
 */
export function usesCustomerContact(
  project: ContactSource,
  customer: CustomerSource,
): boolean {
  return resolveContact(project, customer).every((r) => !r.overridden);
}

/** How many of the four the project answers for itself. */
export function overriddenCount(
  project: ContactSource,
  customer: CustomerSource,
): number {
  return resolveContact(project, customer).filter((r) => r.overridden).length;
}

export type ClearOverridesPatch = {
  project_address: null;
  project_contact_name: null;
  project_contact_email: null;
  project_contact_phone: null;
};

/** The patch that switches a project back to the customer's details. */
export function clearOverridesPatch(): ClearOverridesPatch {
  return {
    project_address: null,
    project_contact_name: null,
    project_contact_email: null,
    project_contact_phone: null,
  };
}
