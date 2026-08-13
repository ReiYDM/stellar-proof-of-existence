// Toàn bộ việc tính hash diễn ra ngay trên trình duyệt của người dùng.
// Nội dung gốc (file, văn bản...) KHÔNG bao giờ được gửi đi đâu cả —
// chỉ có 32 byte hash SHA-256 được gửi lên smart contract.

export interface HashResult {
  bytes: Uint8Array; // 32 byte, dùng để đưa vào contract (BytesN<32>)
  hex: string; // dạng hex để hiển thị / nhập tay khi xác minh
}

export async function hashArrayBuffer(buffer: ArrayBuffer): Promise<HashResult> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = new Uint8Array(digest);
  const hex = toHex(bytes);
  return { bytes, hex };
}

export async function hashFile(file: File): Promise<HashResult> {
  const buffer = await file.arrayBuffer();
  return hashArrayBuffer(buffer);
}

export async function hashText(text: string): Promise<HashResult> {
  const encoder = new TextEncoder();
  return hashArrayBuffer(encoder.encode(text).buffer);
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/i, "");
  if (clean.length !== 64) {
    throw new Error("Hash phải là chuỗi hex 64 ký tự (SHA-256 / 32 byte).");
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
}
