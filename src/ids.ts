// Short-path / token generation and validation (keeps old Django conventions).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export const PATH_RE = /^[A-Za-z0-9]{8,32}$/;
export const ID_RE = /^[A-Za-z0-9._-]+$/;

export function validatePath(path: string | undefined | null): path is string {
  return !!path && PATH_RE.test(path);
}

export function validateId(v: string | undefined | null, max = 100): boolean {
  return !!v && v.length <= max && ID_RE.test(v);
}

export function randomPath(length = 8): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[buf[i]! % ALPHABET.length];
  return out;
}

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const newEditToken = (): string => randomHex(16); // 32 hex chars
export const newAccessToken = (): string => randomHex(32); // 64 hex chars
