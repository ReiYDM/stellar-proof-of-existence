# ProofStamp — Đóng dấu thời gian (Proof-of-Existence) trên Stellar

contract lưu **hash của nội dung + timestamp** để
chứng minh "tôi đã sở hữu/tạo ra nội dung này tại thời điểm này".

## Vấn đề giải quyết

Nhà văn, lập trình viên, nhạc sĩ, biên kịch, founder startup... thường cần
chứng minh một ý tưởng/nội dung đã tồn tại vào một thời điểm nhất định
(trước khi công bố, trước khi nộp hồ sơ, trước khi ký hợp đồng...). Cách làm
truyền thống (gửi email cho chính mình, đăng ký bản quyền) chậm, tốn phí,
hoặc dễ bị nghi ngờ tính xác thực.

**ProofStamp** giải quyết việc này bằng cách:
1. Tính hash SHA-256 của nội dung **ngay trên trình duyệt** — nội dung gốc
   không bao giờ rời khỏi máy người dùng.
2. Ghi hash đó lên blockchain Stellar (qua Soroban smart contract) cùng với
   timestamp của ledger và địa chỉ ví người gửi.
3. Bất kỳ ai cũng có thể xác minh sau này: đưa lại đúng nội dung/hash vào,
   hệ thống trả về ai đã đăng ký, vào lúc nào — mà không cần biết nội dung
   đó là gì.

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
└── frontend/                           # Web app (Vite + TypeScript, không framework)
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

## Yêu cầu cài đặt (làm trên VS Code)

1. **Rust** + target WebAssembly:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustup target add wasm32v1-none
   ```
   (nếu dùng SDK/CLI cũ hơn, target có thể là `wasm32-unknown-unknown`)

2. **Stellar CLI**:
   ```bash
   cargo install --locked stellar-cli
   ```

3. **Node.js** (>= 18) cho frontend.

4. Extension VS Code nên cài: `rust-analyzer`, `Even Better TOML`, `ESLint`,
   `Prettier`.

## Bước 1 — Build & test contract

```bash
cd poe-stellar
cargo test -p proof-of-existence
stellar contract build
```

File wasm sẽ nằm ở `target/wasm32v1-none/release/proof_of_existence.wasm`.

## Bước 2 — Deploy lên testnet

```bash
# Tạo identity (ví) để deploy, và fund bằng Friendbot
stellar keys generate deployer --network testnet --fund

# Deploy contract
stellar contract deploy \
  --wasm target/wasm32v1-none/release/proof_of_existence.wasm \
  --source deployer \
  --network testnet \
  --alias proof_of_existence
```

Lệnh trên trả về một **Contract ID** (bắt đầu bằng `C...`). Lưu lại giá trị này.

Có thể thử nhanh bằng CLI trước khi làm frontend:
```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- \
  create_proof \
  --owner <ĐỊA_CHỈ_VÍ_CỦA_DEPLOYER> \
  --content_hash 0000000000000000000000000000000000000000000000000000000000000001 \
  --title "Test proof" \
  --metadata_uri ""
```

## Bước 3 — Cấu hình & chạy frontend

```bash
cd frontend
cp .env.example .env
# Mở .env, dán Contract ID vừa deploy vào VITE_CONTRACT_ID

npm install
npm run dev
```

Mở trình duyệt tại `http://localhost:5173`, cài extension ví
[Freighter](https://www.freighter.app/) (chuyển sang mạng **Testnet** trong
cài đặt Freighter), rồi:

1. Bấm **Kết nối ví Freighter**.
2. Tab **Tạo bằng chứng**: chọn file hoặc dán văn bản → **Tính hash** → nhập
   tiêu đề → **Ghi dấu thời gian lên Stellar** (Freighter sẽ hiện popup xác
   nhận ký giao dịch).
3. Tab **Xác minh**: đưa lại file/văn bản/hash để kiểm tra ai đã đăng ký và
   vào lúc nào.
4. Tab **Bằng chứng của tôi**: xem toàn bộ proof mà ví đang kết nối đã tạo.

## Ghi chú & hướng mở rộng

- Vì nội dung gốc không bao giờ lên chain, đây **không phải** là nơi lưu trữ
  file — nếu muốn kèm bản sao lưu, có thể tải file lên IPFS/Arweave và dán
  link vào ô "Link tham khảo" (metadata_uri), contract chỉ lưu link đó, không
  lưu nội dung file.
- Có thể cấp "chứng chỉ" PDF (kèm hash, mã giao dịch, QR link explorer) để
  người dùng in ra/lưu trữ — hướng phát triển tiếp theo cho phần frontend.
- Muốn triển khai mainnet: đổi `VITE_RPC_URL` sang RPC mainnet và
  `VITE_NETWORK_PASSPHRASE` sang `"Public Global Stellar Network ; September 2015"`,
  deploy lại contract với `--network mainnet`.
- `@stellar/stellar-sdk` cập nhật khá thường xuyên — nếu gặp lỗi liên quan
  đến `rpc`/`SorobanRpc` khi `npm install`, kiểm tra phiên bản đã cài
  (`npm ls @stellar/stellar-sdk`) và đối chiếu với
  [tài liệu chính thức](https://developers.stellar.org/docs).
