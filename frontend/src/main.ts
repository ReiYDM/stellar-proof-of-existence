import "./style.css";
import { hashFile, hashText, hexToBytes, toHex } from "./lib/hash";
import { connectWallet } from "./lib/wallet";
import { createProof, getProofsByOwner, getProof, verifyByHash } from "./lib/contract";

const app = document.querySelector<HTMLDivElement>("#app")!;

let walletAddress: string | null = null;
let lastComputedHash: Uint8Array | null = null;
let lastComputedHex: string | null = null;

app.innerHTML = `
  <header class="topbar">
    <div class="brand">🔖 ProofStamp</div>
    <div class="subtitle">Đóng dấu thời gian (Proof-of-Existence) cho nội dung của bạn trên Stellar</div>
    <button id="connectBtn" class="btn btn-outline">Kết nối ví Freighter</button>
  </header>

  <nav class="tabs">
    <button class="tab-btn active" data-tab="create">Tạo bằng chứng</button>
    <button class="tab-btn" data-tab="verify">Xác minh</button>
    <button class="tab-btn" data-tab="mine">Bằng chứng của tôi</button>
  </nav>

  <main>
    <section id="tab-create" class="tab-panel active">
      <p class="hint">
        Nội dung của bạn <strong>không</strong> được tải lên đâu cả — chúng tôi chỉ tính hash
        (SHA-256) ngay trên trình duyệt và ghi hash đó lên blockchain Stellar.
      </p>

      <div class="field">
        <label>Chọn file (bản thảo, mp3, mã nguồn, PDF...)</label>
        <input type="file" id="fileInput" />
      </div>
      <div class="or">— hoặc —</div>
      <div class="field">
        <label>Dán văn bản trực tiếp</label>
        <textarea id="textInput" rows="6" placeholder="Dán nội dung ý tưởng / kịch bản / đoạn code..."></textarea>
      </div>

      <button id="computeHashBtn" class="btn">Tính hash</button>

      <div id="hashResult" class="hash-box hidden">
        <label>Hash SHA-256 (sẽ được ghi lên chain):</label>
        <code id="hashHex"></code>
      </div>

      <div class="field">
        <label>Tiêu đề</label>
        <input type="text" id="titleInput" placeholder="VD: Kịch bản phim ngắn - Bản nháp 1" />
      </div>
      <div class="field">
        <label>Link tham khảo (tuỳ chọn — IPFS, Google Drive, GitHub...)</label>
        <input type="text" id="metadataInput" placeholder="https://... (không bắt buộc)" />
      </div>

      <button id="submitProofBtn" class="btn btn-primary" disabled>Ghi dấu thời gian lên Stellar</button>
      <div id="submitResult" class="result-box hidden"></div>
    </section>

    <section id="tab-verify" class="tab-panel">
      <p class="hint">Kiểm tra xem một file/văn bản đã từng được đóng dấu thời gian hay chưa.</p>
      <div class="field">
        <label>Chọn file cần xác minh</label>
        <input type="file" id="verifyFileInput" />
      </div>
      <div class="or">— hoặc —</div>
      <div class="field">
        <label>Dán văn bản</label>
        <textarea id="verifyTextInput" rows="4" placeholder="Dán nội dung cần kiểm tra..."></textarea>
      </div>
      <div class="or">— hoặc —</div>
      <div class="field">
        <label>Nhập trực tiếp hash (hex, 64 ký tự)</label>
        <input type="text" id="verifyHashInput" placeholder="vd: 3a7bd3e2360a3d..." />
      </div>
      <button id="verifyBtn" class="btn btn-primary">Xác minh</button>
      <div id="verifyResult" class="result-box hidden"></div>
    </section>

    <section id="tab-mine" class="tab-panel">
      <p class="hint">Danh sách các proof mà ví đang kết nối đã tạo.</p>
      <button id="loadMineBtn" class="btn">Tải danh sách</button>
      <div id="mineResult" class="result-box hidden"></div>
    </section>
  </main>
`;

// ---------- Tabs ----------
document.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(`#tab-${btn.dataset.tab}`)!.classList.add("active");
  });
});

// ---------- Wallet ----------
const connectBtn = document.querySelector<HTMLButtonElement>("#connectBtn")!;
connectBtn.addEventListener("click", async () => {
  try {
    connectBtn.textContent = "Đang kết nối...";
    walletAddress = await connectWallet();
    connectBtn.textContent = `✅ ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    connectBtn.classList.add("connected");
    (document.querySelector("#submitProofBtn") as HTMLButtonElement).disabled = !lastComputedHash;
  } catch (err: any) {
    alert(err.message || "Không thể kết nối ví.");
    connectBtn.textContent = "Kết nối ví Freighter";
  }
});

// ---------- Tính hash để tạo proof ----------
const computeHashBtn = document.querySelector<HTMLButtonElement>("#computeHashBtn")!;
const hashResultBox = document.querySelector<HTMLDivElement>("#hashResult")!;
const hashHexEl = document.querySelector<HTMLElement>("#hashHex")!;
const submitProofBtn = document.querySelector<HTMLButtonElement>("#submitProofBtn")!;

computeHashBtn.addEventListener("click", async () => {
  const fileInput = document.querySelector<HTMLInputElement>("#fileInput")!;
  const textInput = document.querySelector<HTMLTextAreaElement>("#textInput")!;

  try {
    let result;
    if (fileInput.files && fileInput.files.length > 0) {
      result = await hashFile(fileInput.files[0]);
    } else if (textInput.value.trim().length > 0) {
      result = await hashText(textInput.value);
    } else {
      alert("Hãy chọn file hoặc dán văn bản trước.");
      return;
    }

    lastComputedHash = result.bytes;
    lastComputedHex = result.hex;
    hashHexEl.textContent = result.hex;
    hashResultBox.classList.remove("hidden");
    submitProofBtn.disabled = !walletAddress;
  } catch (err: any) {
    alert("Lỗi khi tính hash: " + err.message);
  }
});

// ---------- Gửi proof lên chain ----------
const submitResultBox = document.querySelector<HTMLDivElement>("#submitResult")!;

submitProofBtn.addEventListener("click", async () => {
  if (!walletAddress || !lastComputedHash) return;

  const title = (document.querySelector<HTMLInputElement>("#titleInput")!).value.trim();
  const metadata = (document.querySelector<HTMLInputElement>("#metadataInput")!).value.trim();

  if (!title) {
    alert("Vui lòng nhập tiêu đề.");
    return;
  }

  submitProofBtn.disabled = true;
  submitProofBtn.textContent = "Đang gửi giao dịch...";
  submitResultBox.classList.add("hidden");

  try {
    const { hash, returnValue } = await createProof(walletAddress, lastComputedHash, title, metadata);
    submitResultBox.innerHTML = `
      <p>✅ Đã đóng dấu thời gian thành công!</p>
      <p><strong>Proof ID:</strong> ${returnValue}</p>
      <p><strong>Hash nội dung:</strong> <code>${lastComputedHex}</code></p>
      <p><strong>Giao dịch:</strong>
        <a href="https://stellar.expert/explorer/testnet/tx/${hash}" target="_blank" rel="noopener">
          Xem trên Stellar Expert ↗
        </a>
      </p>
    `;
    submitResultBox.classList.remove("hidden");
  } catch (err: any) {
    submitResultBox.innerHTML = `<p>❌ Lỗi: ${err.message}</p>`;
    submitResultBox.classList.remove("hidden");
  } finally {
    submitProofBtn.disabled = false;
    submitProofBtn.textContent = "Ghi dấu thời gian lên Stellar";
  }
});

// ---------- Xác minh ----------
const verifyBtn = document.querySelector<HTMLButtonElement>("#verifyBtn")!;
const verifyResultBox = document.querySelector<HTMLDivElement>("#verifyResult")!;

verifyBtn.addEventListener("click", async () => {
  if (!walletAddress) {
    alert("Hãy kết nối ví trước (chỉ dùng để đọc dữ liệu, không tốn phí).");
    return;
  }

  const fileInput = document.querySelector<HTMLInputElement>("#verifyFileInput")!;
  const textInput = document.querySelector<HTMLTextAreaElement>("#verifyTextInput")!;
  const hashInput = document.querySelector<HTMLInputElement>("#verifyHashInput")!;

  try {
    let bytes: Uint8Array;
    if (hashInput.value.trim()) {
      bytes = hexToBytes(hashInput.value);
    } else if (fileInput.files && fileInput.files.length > 0) {
      bytes = (await hashFile(fileInput.files[0])).bytes;
    } else if (textInput.value.trim()) {
      bytes = (await hashText(textInput.value)).bytes;
    } else {
      alert("Hãy chọn file, dán văn bản, hoặc nhập hash.");
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = "Đang kiểm tra...";

    const record: any = await verifyByHash(walletAddress, bytes);

    if (!record) {
      verifyResultBox.innerHTML = `<p>ℹ️ Chưa có bằng chứng nào cho nội dung này (hash: <code>${toHex(bytes)}</code>).</p>`;
    } else {
      const date = new Date(Number(record.timestamp) * 1000).toLocaleString("vi-VN");
      verifyResultBox.innerHTML = `
        <p>✅ Đã tìm thấy bằng chứng!</p>
        <p><strong>Chủ sở hữu:</strong> <code>${record.owner}</code></p>
        <p><strong>Tiêu đề:</strong> ${record.title}</p>
        <p><strong>Thời điểm ghi nhận:</strong> ${date}</p>
        ${record.metadata_uri ? `<p><strong>Link:</strong> <a href="${record.metadata_uri}" target="_blank">${record.metadata_uri}</a></p>` : ""}
      `;
    }
    verifyResultBox.classList.remove("hidden");
  } catch (err: any) {
    verifyResultBox.innerHTML = `<p>❌ Lỗi: ${err.message}</p>`;
    verifyResultBox.classList.remove("hidden");
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Xác minh";
  }
});

// ---------- Danh sách proof của tôi ----------
const loadMineBtn = document.querySelector<HTMLButtonElement>("#loadMineBtn")!;
const mineResultBox = document.querySelector<HTMLDivElement>("#mineResult")!;

loadMineBtn.addEventListener("click", async () => {
  if (!walletAddress) {
    alert("Hãy kết nối ví trước.");
    return;
  }
  loadMineBtn.disabled = true;
  loadMineBtn.textContent = "Đang tải...";

  try {
    const ids: any = await getProofsByOwner(walletAddress, walletAddress);
    if (!ids || ids.length === 0) {
      mineResultBox.innerHTML = `<p>Bạn chưa tạo bằng chứng nào.</p>`;
    } else {
      const items = await Promise.all(
        ids.map(async (id: bigint) => {
          const r: any = await getProof(walletAddress!, id);
          const date = new Date(Number(r.timestamp) * 1000).toLocaleString("vi-VN");
          return `<li><strong>#${r.id}</strong> — ${r.title} <span class="muted">(${date})</span></li>`;
        })
      );
      mineResultBox.innerHTML = `<ul class="proof-list">${items.join("")}</ul>`;
    }
    mineResultBox.classList.remove("hidden");
  } catch (err: any) {
    mineResultBox.innerHTML = `<p>❌ Lỗi: ${err.message}</p>`;
    mineResultBox.classList.remove("hidden");
  } finally {
    loadMineBtn.disabled = false;
    loadMineBtn.textContent = "Tải danh sách";
  }
});
