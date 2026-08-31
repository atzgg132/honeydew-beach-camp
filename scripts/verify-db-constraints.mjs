#!/usr/bin/env node
/**
 * Asserts that the invariants Prisma Schema Language cannot express actually exist in the
 * target database.
 *
 * These constraints are the last line of defence against double-booking and against money
 * drifting out of integer paise. They live in the trailer of a hand-written migration, so a
 * squashed migration, a `prisma db push`, or a restore from an older dump can quietly drop
 * them while every table still looks correct. This script is what makes that loud.
 *
 * Usage: node scripts/verify-db-constraints.mjs
 * Reads DIRECT_URL, falling back to DATABASE_URL.
 */
import { config as loadEnv } from "dotenv";
import pg from "pg";

loadEnv({ path: [".env.local", ".env"], quiet: true });

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DIRECT_URL or DATABASE_URL is required.");
  process.exit(1);
}

/** Exclusion constraint: the final double-booking guard. */
const EXCLUSION = { table: "RoomReservation", name: "RoomReservation_no_overlap" };

/** Partial unique indexes that cannot be expressed in the Prisma schema. */
const PARTIAL_UNIQUE_INDEXES = [
  "TariffRevision_one_active_key",
  "BookingPolicyRevision_one_active_key",
  "RoomReservation_one_active_booking_room_key",
];

/** Every hand-written CHECK constraint, by table. */
const CHECK_CONSTRAINTS = {
  HotelSettings: ["HotelSettings_operational_values_check"],
  RoomGroup: ["RoomGroup_occupancy_check"],
  TariffRate: ["TariffRate_money_check"],
  BookingPolicyRevision: ["BookingPolicyRevision_values_check"],
  Booking: [
    "Booking_dates_check",
    "Booking_composition_check",
    "Booking_money_check",
    "Booking_lifecycle_check",
  ],
  BookingRoom: ["BookingRoom_composition_check", "BookingRoom_money_check"],
  RoomReservation: [
    "RoomReservation_dates_check",
    "RoomReservation_owner_check",
    "RoomReservation_hold_expiry_check",
    "RoomReservation_state_timestamps_check",
  ],
  PaymentOrder: ["PaymentOrder_money_check"],
  PaymentTransaction: ["PaymentTransaction_money_check"],
  Cancellation: ["Cancellation_money_check"],
  RateLimitBucket: ["RateLimitBucket_values_check"],
};

const failures = [];
const client = new pg.Client({ connectionString });

function fail(message) {
  failures.push(message);
}

async function main() {
  await client.connect();

  // btree_gist supplies the equality operator class the exclusion constraint needs.
  const extension = await client.query(`SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'`);
  if (extension.rowCount === 0) fail("extension btree_gist is not installed");

  // The exclusion constraint, verified by kind ('x') rather than by name alone, so a
  // same-named constraint of a different kind cannot pass.
  const exclusion = await client.query(
    `SELECT c.contype, pg_get_constraintdef(c.oid) AS definition
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
      WHERE t.relname = $1 AND c.conname = $2`,
    [EXCLUSION.table, EXCLUSION.name],
  );
  if (exclusion.rowCount === 0) {
    fail(`missing exclusion constraint ${EXCLUSION.name} on "${EXCLUSION.table}"`);
  } else {
    const { contype, definition } = exclusion.rows[0];
    if (contype !== "x") fail(`${EXCLUSION.name} exists but is not an EXCLUDE constraint (contype=${contype})`);
    // Half-open range: a checkout date must be reusable as the next check-in date.
    if (!definition.includes("'[)'::text")  && !definition.includes("'[)'")) {
      fail(`${EXCLUSION.name} does not use a half-open '[)' daterange: ${definition}`);
    }
    if (!/HELD/.test(definition) || !/CONFIRMED/.test(definition)) {
      fail(`${EXCLUSION.name} is not restricted to HELD/CONFIRMED states: ${definition}`);
    }
  }

  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname = ANY($1)`,
    [PARTIAL_UNIQUE_INDEXES],
  );
  const foundIndexes = new Set(indexes.rows.map((row) => row.indexname));
  for (const name of PARTIAL_UNIQUE_INDEXES) {
    if (!foundIndexes.has(name)) fail(`missing partial unique index ${name}`);
  }

  const checks = await client.query(
    `SELECT t.relname AS table_name, c.conname AS name
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
      WHERE c.contype = 'c'`,
  );
  const foundChecks = new Set(checks.rows.map((row) => `${row.table_name}.${row.name}`));
  for (const [table, names] of Object.entries(CHECK_CONSTRAINTS)) {
    for (const name of names) {
      if (!foundChecks.has(`${table}.${name}`)) fail(`missing CHECK constraint ${name} on "${table}"`);
    }
  }

  const expected =
    1 + PARTIAL_UNIQUE_INDEXES.length + Object.values(CHECK_CONSTRAINTS).flat().length;

  if (failures.length > 0) {
    console.error(`Database invariant verification FAILED (${failures.length} problem(s)):`);
    for (const message of failures) console.error(`  - ${message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Database invariants verified: ${expected} constraints and indexes present.`);
}

main()
  .catch((error) => {
    console.error("Verification could not complete:", error.message);
    process.exitCode = 1;
  })
  .finally(() => client.end());
