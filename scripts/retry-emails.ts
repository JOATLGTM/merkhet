/**
 * Flush anything sitting in `email_outbox` with status = failed.
 *
 *   npm run email:retry
 *
 * Sends the stored html, not a fresh render — a retry delivers the message
 * that was planned, not whatever the templates produce today.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { retryFailed } = await import("../lib/email/send");
  const outcome = await retryFailed();
  const redirected = outcome.redirected
    ? `, ${outcome.redirected} redirected to owner`
    : "";
  console.log(
    `retried: ${outcome.sent} sent${redirected}, ${outcome.failed} still failing`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
