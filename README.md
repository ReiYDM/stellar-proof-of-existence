# ProofStamp — Đóng dấu thời gian (Proof-of-Existence) trên Stellar

Công cụ giúp nhà văn, lập trình viên, nhạc sĩ, biên kịch, founder startup...
chứng minh "tôi đã sở hữu/tạo ra nội dung này tại thời điểm này", bằng cách
ghi hash (dấu vân tay số) của nội dung lên blockchain Stellar (Soroban smart
contract). Dự án phát triển dựa trên kiến trúc của
[stellar-notes-dapp](https://github.com/minhbear/stellar-notes-dapp).

## Vấn đề giải quyết

Cách chứng minh ý tưởng/nội dung đã tồn tại vào một thời điểm truyền thống
(gửi email cho chính mình, đăng ký bản quyền...) chậm, tốn phí, hoặc dễ bị
nghi ngờ tính xác thực. ProofStamp giải quyết việc này bằng 3 bước:

1. Tính hash SHA-256 của nội dung **ngay trên trình duyệt** — nội dung gốc
   không bao giờ rời khỏi máy người dùng, không upload lên đâu cả.
2. Ghi hash đó lên blockchain Stellar cùng timestamp của ledger và địa chỉ
   ví người gửi.
3. Bất kỳ ai cũng có thể xác minh sau này: đưa lại đúng nội dung/hash vào,
   hệ thống trả về ai đã đăng ký, vào lúc nào — mà không cần biết nội dung
   đó thực sự là gì.

## Kiến trúc dự án

```
poe-stellar/
├── Cargo.toml                          # Rust workspace
├── contracts/
│   └── proof_of_existence/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs                  # Smart contract Soroban
│           └── test.rs                 # Unit tests
└── frontend/                           # Web app (Vite + TypeScript thuần)
    ├── package.json
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.ts                     # Giao diện & luồng xử lý
        ├── style.css
        └── lib/
            ├── hash.ts                 # Tính SHA-256 phía client
            ├── wallet.ts                # Kết nối ví Freighter
            └── contract.ts             # Gọi smart contract qua Soroban RPC
```

### Smart contract — các hàm chính

| Hàm | Mô tả |
|---|---|
| `create_proof(owner, content_hash, title, metadata_uri) -> id` | Đăng ký proof mới. Nếu hash đã tồn tại, trả về id cũ (người nộp sớm nhất luôn thắng). Cần `owner` ký giao dịch. |
| `get_proof(id) -> ProofRecord` | Lấy chi tiết 1 proof. |
| `get_proofs_by_owner(owner) -> Vec<id>` | Danh sách proof của 1 địa chỉ ví. |
| `verify_by_hash(content_hash) -> Option<ProofRecord>` | Tra cứu proof theo hash — dùng để xác minh. |
| `total_proofs() -> u64` | Tổng số proof đã đăng ký. |

---

## Yêu cầu cài đặt (một lần duy nhất trên máy)

1. **Rust** + target WebAssembly:
   ```bash
   rustup update stable
   rustup target add wasm32v1-none
   ```

2. **Stellar CLI**:
   ```bash
   cargo install --locked stellar-cli
   stellar --version   # kiểm tra đã cài thành công
   ```

3. **Node.js** ≥ 18 — tải tại [nodejs.org](https://nodejs.org).

4. **Windows only** — PowerShell mặc định chặn chạy script (`npm` sẽ báo lỗi
   `running scripts is disabled on this system`). Mở PowerShell **với quyền
   Administrator** (chuột phải → *Run as administrator*, cửa sổ phải có
   prompt bắt đầu bằng `PS`), chạy:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
   gõ `Y` khi được hỏi. Chỉ cần làm một lần.

5. Extension VS Code nên cài: `rust-analyzer`, `Even Better TOML`.

6. **Ví Freighter** trên trình duyệt: cài tại [freighter.app](https://www.freighter.app/),
   tạo ví mới, vào phần cài đặt của Freighter và chuyển network sang
   **Testnet**.

---

## Bước 1 — Build & test smart contract

```bash
cd poe-stellar
cargo test -p proof-of-existence
```

Nếu gặp lỗi dạng:
```
the trait bound `ChaCha20Rng: ed25519_dalek::rand_core::CryptoRng` is not satisfied
```
đây là xung đột phiên bản giữa các crate phụ thuộc (một bản `ed25519-dalek`
mới ra chưa tương thích ngược với `soroban-env-host`), **không phải lỗi
trong code**. Sửa bằng cách ghim `ed25519-dalek` về bản cũ tương thích:
```bash
cargo update -p ed25519-dalek@3.0.0 --precise 2.1.1
cargo test -p proof-of-existence
```

Sau khi test pass, build ra file WebAssembly:
```bash
stellar contract build
```
File kết quả nằm ở `target/wasm32v1-none/release/proof_of_existence.wasm`.

Nếu bước này báo lỗi `can't find crate for core` / `wasm32v1-none may not be
installed`, chạy lại `rustup target add wasm32v1-none` (xem phần Yêu cầu cài
đặt ở trên) rồi build lại.

## Bước 2 — Deploy contract lên testnet

```bash
# Tạo ví để deploy, tự động nạp XLM test qua Friendbot
stellar keys generate deployer --network testnet --fund
```

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/proof_of_existence.wasm \
  --source deployer \
  --network testnet \
  --alias proof_of_existence
```

> Trên **Windows PowerShell**, thay dấu tiếp dòng `\` bằng backtick `` ` ``:
> ```powershell
> stellar contract deploy `
>   --wasm target/wasm32v1-none/release/proof_of_existence.wasm `
>   --source deployer `
>   --network testnet `
>   --alias proof_of_existence
> ```

Lệnh trên in ra một **Contract ID** (bắt đầu bằng chữ `C...`) — copy lại,
bước sau sẽ dùng đến.

## Bước 3 — Cấu hình & chạy frontend

```bash
cd frontend
cp .env.example .env    # Windows: copy .env.example .env
```

Mở `.env` vừa tạo, dán Contract ID ở Bước 2 vào `VITE_CONTRACT_ID`, lưu lại:
```
VITE_CONTRACT_ID=CA62J42LD6TGO4Y2L37T2VTNYDTWIBGSRHQSSDSXNA6WSBVZ5VZVNYMO
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

Cài dependencies và chạy dev server:
```bash
npm install
npm run dev
```

Mở trình duyệt tại địa chỉ terminal in ra (mặc định `http://localhost:5173`).

## Bước 4 — Nạp XLM test cho ví Freighter (bắt buộc, mỗi ví mới 1 lần)

Ví mới tạo trên Freighter chưa tồn tại trên ledger, kể cả để đọc dữ liệu.
Nếu gặp lỗi `Account not found: G...`, nạp XLM test miễn phí bằng cách:

1. Copy địa chỉ ví (bắt đầu bằng `G`) từ Freighter.
2. Mở URL sau trong trình duyệt (thay địa chỉ của bạn vào):
   ```
   https://friendbot.stellar.org/?addr=ĐỊA_CHỈ_VÍ_CỦA_BẠN
   ```
3. Thấy phản hồi JSON không báo lỗi tức là đã nạp thành công (10,000 XLM test).

Quay lại web app, tải lại trang, kết nối lại ví.

## Bước 5 — Sử dụng

1. Bấm **Kết nối ví Freighter**.
2. Tab **Tạo bằng chứng**: chọn file hoặc dán văn bản → **Tính hash** → nhập
   tiêu đề → **Ghi dấu thời gian lên Stellar** (Freighter hiện popup xác nhận
   ký giao dịch).
3. Tab **Xác minh**: đưa lại file/văn bản/hash để kiểm tra ai đã đăng ký và
   vào lúc nào.
4. Tab **Bằng chứng của tôi**: xem toàn bộ proof mà ví đang kết nối đã tạo.

---

## Troubleshooting — các lỗi thường gặp

| Lỗi | Nguyên nhân | Cách sửa |
|---|---|---|
| `running scripts is disabled on this system` khi chạy `npm` | Windows PowerShell chặn script theo mặc định | Xem mục 4 phần Yêu cầu cài đặt ở trên |
| `ChaCha20Rng: ed25519_dalek::rand_core::CryptoRng is not satisfied` khi `cargo test` | Xung đột phiên bản `ed25519-dalek` trong cây phụ thuộc | `cargo update -p ed25519-dalek@3.0.0 --precise 2.1.1` |
| `can't find crate for core` / `wasm32v1-none may not be installed` khi `stellar contract build` | Chưa cài target WebAssembly cho Rust | `rustup target add wasm32v1-none` |
| `Không tìm thấy ví Freighter` | Chưa cài extension, hoặc đang mở web app bằng trình duyệt khác với trình duyệt đã cài Freighter | Cài tại freighter.app trên đúng trình duyệt đang dùng để mở app |
| `Account not found: G...` | Ví mới tạo chưa có trên ledger testnet | Nạp XLM qua Friendbot — xem Bước 4 |
| `Bad union switch: 4` khi gọi contract từ frontend | `@stellar/stellar-sdk` cài trong `package.json` quá cũ, không đọc được định dạng dữ liệu giao dịch của Protocol 23 hiện tại trên testnet | `npm install @stellar/stellar-sdk@latest` rồi chạy lại `npm run dev` |
| `Chưa cấu hình VITE_CONTRACT_ID` | Quên tạo/điền file `.env` | Xem Bước 3 |

---

## Ghi chú & hướng mở rộng

- Nội dung gốc không bao giờ lên chain, đây **không phải** nơi lưu trữ file
  — muốn kèm bản sao lưu, tải file lên IPFS/Arweave và dán link vào ô "Link
  tham khảo" (metadata_uri); contract chỉ lưu link đó, không lưu nội dung.
- Có thể cấp "chứng chỉ" PDF (kèm hash, mã giao dịch, QR link explorer) để
  người dùng in ra/lưu trữ — hướng phát triển tiếp theo cho phần frontend.
- Muốn triển khai mainnet: đổi `VITE_RPC_URL` sang RPC mainnet và
  `VITE_NETWORK_PASSPHRASE` sang
  `"Public Global Stellar Network ; September 2015"`, deploy lại contract
  với `--network mainnet`.
- Hệ sinh thái Soroban / `@stellar/stellar-sdk` cập nhật khá thường xuyên;
  nếu gặp lỗi lạ không có trong bảng Troubleshooting, kiểm tra phiên bản đã
  cài (`npm ls @stellar/stellar-sdk`, `stellar --version`) và đối chiếu với
  [tài liệu chính thức](https://developers.stellar.org/docs).
