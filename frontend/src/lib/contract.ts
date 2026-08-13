// Lớp giao tiếp với smart contract Proof of Existence trên Soroban (Stellar).
//
// LƯU Ý PHIÊN BẢN: code này viết cho @stellar/stellar-sdk v12.x, nơi module
// Soroban RPC được export dưới tên `rpc`. Nếu bạn dùng SDK < 12, đổi import
// `rpc` thành `SorobanRpc` (API tương đương: SorobanRpc.Server, SorobanRpc.Api...).

import {
  rpc,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
} from "@stellar/stellar-sdk";
import { signXdr } from "./wallet";

const CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID;
const RPC_URL = import.meta.env.VITE_RPC_URL;
const NETWORK_PASSPHRASE = import.meta.env.VITE_NETWORK_PASSPHRASE;

function getServer() {
  return new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
}

function getContract() {
  if (!CONTRACT_ID) {
    throw new Error("Chưa cấu hình VITE_CONTRACT_ID trong file .env (xem .env.example).");
  }
  return new Contract(CONTRACT_ID);
}

async function buildTx(sourcePublicKey: string, method: string, args: any[]) {
  const server = getServer();
  const account = await server.getAccount(sourcePublicKey);
  const contract = getContract();

  return new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();
}

/** Gọi hàm read-only: không cần phí, không ghi lên chain, chỉ mô phỏng. */
export async function readCall(sourcePublicKey: string, method: string, args: any[] = []) {
  const server = getServer();
  const tx = await buildTx(sourcePublicKey, method, args);
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  if (!("result" in sim) || !sim.result) return undefined;
  return scValToNative(sim.result.retval);
}

/** Gọi hàm ghi dữ liệu: mô phỏng -> ký bằng ví -> gửi lên mạng -> chờ xác nhận. */
export async function writeCall(
  sourcePublicKey: string,
  method: string,
  args: any[]
): Promise<{ hash: string; returnValue?: unknown }> {
  const server = getServer();
  const tx = await buildTx(sourcePublicKey, method, args);

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }

  const prepared = rpc.assembleTransaction(tx, sim).build();
  const signedXdr = await signXdr(prepared.toXDR(), {
    networkPassphrase: NETWORK_PASSPHRASE,
    address: sourcePublicKey,
  });

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const sendResult = await server.sendTransaction(signedTx);

  if (sendResult.status === "ERROR") {
    throw new Error("Mạng Stellar từ chối giao dịch (kiểm tra số dư XLM / cấu hình).");
  }

  let getResult = await server.getTransaction(sendResult.hash);
  let attempts = 0;
  while (getResult.status === "NOT_FOUND" && attempts < 20) {
    await new Promise((r) => setTimeout(r, 1500));
    getResult = await server.getTransaction(sendResult.hash);
    attempts++;
  }

  if (getResult.status === "SUCCESS") {
    const returnValue = getResult.returnValue ? scValToNative(getResult.returnValue) : undefined;
    return { hash: sendResult.hash, returnValue };
  }

  throw new Error(`Giao dịch không thành công: ${getResult.status}`);
}

// ---------- Các hàm nghiệp vụ của contract Proof of Existence ----------

export async function createProof(
  ownerAddress: string,
  hashBytes: Uint8Array,
  title: string,
  metadataUri: string
) {
  const args = [
    new Address(ownerAddress).toScVal(),
    nativeToScVal(hashBytes, { type: "bytes" }),
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(metadataUri, { type: "string" }),
  ];
  return writeCall(ownerAddress, "create_proof", args);
}

export async function getProofsByOwner(callerAddress: string, ownerAddress: string) {
  const args = [new Address(ownerAddress).toScVal()];
  return readCall(callerAddress, "get_proofs_by_owner", args);
}

export async function getProof(callerAddress: string, id: bigint) {
  const args = [nativeToScVal(id, { type: "u64" })];
  return readCall(callerAddress, "get_proof", args);
}

export async function verifyByHash(callerAddress: string, hashBytes: Uint8Array) {
  const args = [nativeToScVal(hashBytes, { type: "bytes" })];
  return readCall(callerAddress, "verify_by_hash", args);
}
