import "server-only";
import { logger } from "@/server/observability/logger";

/**
 * Error reporting and alertable failure states.
 *
 * Provider-neutral on purpose: no error-tracking vendor is configured yet, and the choice is
 * an owner decision. Until one is, reports go to the structured log, where they are at least
 * searchable. Adding a vendor means writing one adapter, not touching every call site.
 */

export interface ErrorReport {
  /** Stable identifier for the class of failure, used for alert routing and grouping. */
  kind: AlertKind;
  message: string;
  error?: unknown;
  context?: Record<string, unknown>;
}

/**
 * Failure states that a human needs to know about. Each one means either money or inventory
 * is in a state the system cannot resolve by itself.
 */
export type AlertKind =
  /** Money arrived but the rooms were already gone. Needs staff to reallocate or refund. */
  | "payment.paid_unallocated"
  /** The provider charged an amount we did not ask for. */
  | "payment.amount_mismatch"
  /** A webhook failed signature verification. One is noise; a burst is an attack. */
  | "payment.webhook_unverified"
  /** Local payment state disagrees with the provider's. */
  | "payment.reconciliation_mismatch"
  /** A notification exhausted its retries and will not be delivered without intervention. */
  | "notification.dead_letter"
  /** A scheduled job failed. Holds stop being released and messages stop going out. */
  | "cron.job_failed"
  /** The room-overlap exclusion constraint rejected a write. Expected under contention. */
  | "inventory.overlap_rejected"
  /** Anything unhandled reaching the API boundary. */
  | "api.unhandled";

export interface ErrorReporter {
  report(report: ErrorReport): void;
}

const consoleReporter: ErrorReporter = {
  report({ kind, message, error, context }) {
    logger.error(message, {
      alertKind: kind,
      ...(error instanceof Error ? { errorName: error.name, errorMessage: error.message } : {}),
      ...(context ?? {}),
    });
  },
};

let reporter: ErrorReporter = consoleReporter;

/** Replaces the reporter. Used by tests and, later, by a monitoring adapter. */
export function setErrorReporter(next: ErrorReporter): void {
  reporter = next;
}

export function reportError(report: ErrorReport): void {
  try {
    reporter.report(report);
  } catch {
    // Reporting must never be the reason a request fails.
  }
}
