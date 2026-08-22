/**
 * Merkhet transactional email templates.
 *
 * Rendering only — nothing here opens a connection or sends anything. See
 * `lib/email/README.md` for the routing table and the wiring plan.
 */
export * from "@/lib/email/templates";
export * from "@/lib/email/plan";
export * from "@/lib/email/render";
export {
  AUTH_COPY,
  CUSTOMER_COPY,
  INTERNAL_COPY,
  type AuthKind,
  type CustomerPhase,
} from "@/lib/email/copy";
export { CUSTOMER_PHASES, isCustomerVisible } from "@/lib/email/progress";
export { APP_URL, COLOR, FIRM, FONT } from "@/lib/email/tokens";
