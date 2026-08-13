import {
  isConnected,
  isAllowed,
  setAllowed,
  requestAccess,
  getAddress,
  signTransaction,
} from "@stellar/freighter-api";

export async function ensureFreighterInstalled(): Promise<boolean> {
  const res = await isConnected();
  return !!res.isConnected;
}

export async function connectWallet(): Promise<string> {
  const installed = await ensureFreighterInstalled();
  if (!installed) {
    throw new Error(
      "Không tìm thấy ví Freighter. Hãy cài extension tại https://www.freighter.app/ rồi tải lại trang."
    );
  }

  const allowed = await isAllowed();
  if (!allowed.isAllowed) {
    const access = await setAllowed();
    if (!access.isAllowed) {
      const req = await requestAccess();
      if (req.error) throw new Error(req.error);
    }
  }

  const addr = await getAddress();
  if (addr.error) throw new Error(addr.error);
  return addr.address;
}

export async function signXdr(
  xdr: string,
  opts: { networkPassphrase: string; address: string }
): Promise<string> {
  const result = await signTransaction(xdr, {
    networkPassphrase: opts.networkPassphrase,
    address: opts.address,
  });
  if (result.error) throw new Error(result.error);
  return result.signedTxXdr;
}
