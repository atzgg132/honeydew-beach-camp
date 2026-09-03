import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";

const N = 16_384;
const r = 8;
const p = 1;
const keyLength = 64;

function scryptKey(
  password: string,
  salt: Buffer,
  length: number,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptKey(password, salt, keyLength, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallel = Number(parts[3]);
  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallel)) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await scryptKey(password, salt, expected.length, { N: cost, r: blockSize, p: parallel });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
