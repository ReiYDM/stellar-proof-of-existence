# ProofStamp — Proof-of-Existence Timestamping on Stellar

*[Đọc bằng tiếng Việt](./README.md)*

A tool that lets writers, developers, musicians, screenwriters, startup
founders... prove "I created/owned this content at this point in time" by
recording the content's hash (a digital fingerprint) on the Stellar
blockchain (Soroban smart contract). Built on the architecture of
[stellar-notes-dapp](https://github.com/minhbear/stellar-notes-dapp).

## The problem

Traditional ways to prove an idea/content existed at a certain time
(emailing yourself, registering copyright...) are slow, costly, or easy to
dispute. ProofStamp solves this in 3 steps:

1. Compute a SHA-256 hash of the content **directly in the browser** — the
   original content never leaves the user's machine, nothing is uploaded.
2. Record that hash on the Stellar blockchain along with the ledger
   timestamp and the sender's wallet address.
3. Anyone can later verify: feed in the same content/hash, and the system
   returns who registered it and when — without ever knowing what the
   content actually is.

## Project architecture

```
poe-stellar/
├── Cargo.toml                          # Rust workspace
├── contracts/
│   └── proof_of_existence/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs                  # Soroban smart contract
│           └── test.rs                 # Unit tests
└── frontend/                           # Web app (Vite + plain TypeScript)
    ├── package.json
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.ts                     # UI & app logic
        ├── style.css
        └── lib/
            ├── hash.ts                 # Client-side SHA-256 hashing
            ├── wallet.ts                # Freighter wallet integration
            └── contract.ts             # Contract calls via Soroban RPC
```

### Smart contract — main functions

| Function | Description |
|---|---|
| `create_proof(owner, content_hash, title, metadata_uri) -> id` | Registers a new proof. If the hash already exists, returns the existing id (the earliest submitter always wins). Requires `owner` to sign the transaction. |
| `get_proof(id) -> ProofRecord` | Fetches a single proof's details. |
| `get_proofs_by_owner(owner) -> Vec<id>` | Lists proof ids created by a given wallet address. |
| `verify_by_hash(content_hash) -> Option<ProofRecord>` | Looks up a proof by content hash — used for verification. |
| `total_proofs() -> u64` | Total number of proofs registered. |

---

## Prerequisites (one-time setup)

1. **Rust** + WebAssembly target:
   ```bash
   rustup update stable
   rustup target add wasm32v1-none
   ```

2. **Stellar CLI**:
   ```bash
   cargo install --locked stellar-cli
   stellar --version   # verify install
   ```

3. **Node.js** ≥ 18 — download from [nodejs.org](https://nodejs.org).

4. **Windows only** — PowerShell blocks running scripts by default (`npm`
   will fail with `running scripts is disabled on this system`). Open
   PowerShell **as Administrator** (right-click → *Run as administrator*,
   the prompt must start with `PS`), then run:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```
   Type `Y` when prompted. Only needs to be done once.

5. Recommended VS Code extensions: `rust-analyzer`, `Even Better TOML`.

6. **Freighter wallet** in your browser: install from
   [freighter.app](https://www.freighter.app/), create a new wallet, and in
   Freighter's settings switch the network to **Testnet**.

---

## Step 1 — Build & test the smart contract

```bash
cd poe-stellar
cargo test -p proof-of-existence
```

If you hit an error like:
```
the trait bound `ChaCha20Rng: ed25519_dalek::rand_core::CryptoRng` is not satisfied
```
this is a dependency version conflict (a newer `ed25519-dalek` release that
isn't backward-compatible with `soroban-env-host` yet), **not a bug in the
contract code**. Fix it by pinning `ed25519-dalek` to a compatible version:
```bash
cargo update -p ed25519-dalek@3.0.0 --precise 2.1.1
cargo test -p proof-of-existence
```

Once tests pass, build the WebAssembly binary:
```bash
stellar contract build
```
Output: `target/wasm32v1-none/release/proof_of_existence.wasm`.

If this step fails with `can't find crate for core` / `wasm32v1-none may
not be installed`, re-run `rustup target add wasm32v1-none` (see
Prerequisites above) and build again.

## Step 2 — Deploy the contract to testnet

```bash
# Create a deployer identity, auto-funded via Friendbot
stellar keys generate deployer --network testnet --fund
```

```bash
stellar contract deploy \
  --wasm target/wasm32v1-none/release/proof_of_existence.wasm \
  --source deployer \
  --network testnet \
  --alias proof_of_existence
```

> On **Windows PowerShell**, replace the `\` line continuation with a
> backtick `` ` ``:
> ```powershell
> stellar contract deploy `
>   --wasm target/wasm32v1-none/release/proof_of_existence.wasm `
>   --source deployer `
>   --network testnet `
>   --alias proof_of_existence
> ```

This prints a **Contract ID** (starting with `C...`) — copy it, you'll need
it in the next step.

## Step 3 — Configure & run the frontend

```bash
cd frontend
cp .env.example .env    # Windows: copy .env.example .env
```

Open the new `.env` file, paste the Contract ID from Step 2 into
`VITE_CONTRACT_ID`, and save:
```
VITE_CONTRACT_ID=CA62J42LD6TGO4Y2L37T2VTNYDTWIBGSRHQSSDSXNA6WSBVZ5VZVNYMO
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

Install dependencies and start the dev server:
```bash
npm install
npm run dev
```

Open the URL printed in the terminal (default `http://localhost:5173`).

## Step 4 — Fund your Freighter wallet with test XLM (required, once per new wallet)

A freshly created wallet doesn't exist on the ledger yet, even for read
calls. If you see `Account not found: G...`, fund it for free:

1. Copy your wallet address (starts with `G`) from Freighter.
2. Open this URL in your browser (with your own address):
   ```
   https://friendbot.stellar.org/?addr=YOUR_WALLET_ADDRESS
   ```
3. A JSON response with no error means it worked (you now have 10,000 test
   XLM).

Go back to the app, reload the page, and reconnect the wallet.

## Step 5 — Using the app

1. Click **Connect Freighter Wallet**.
2. **Create Proof** tab: choose a file or paste text → **Compute Hash** →
   enter a title → **Timestamp on Stellar** (Freighter will pop up asking
   you to sign the transaction).
3. **Verify** tab: feed in the same file/text/hash to check who registered
   it and when.
4. **My Proofs** tab: view all proofs created by the connected wallet.

---

## Troubleshooting — common errors

| Error | Cause | Fix |
|---|---|---|
| `running scripts is disabled on this system` when running `npm` | Windows PowerShell blocks scripts by default | See prerequisite #4 above |
| `ChaCha20Rng: ed25519_dalek::rand_core::CryptoRng is not satisfied` during `cargo test` | Version conflict in `ed25519-dalek` within the dependency tree | `cargo update -p ed25519-dalek@3.0.0 --precise 2.1.1` |
| `can't find crate for core` / `wasm32v1-none may not be installed` during `stellar contract build` | Rust's WebAssembly target isn't installed | `rustup target add wasm32v1-none` |
| `Freighter wallet not found` | Extension not installed, or the app is open in a different browser than the one with Freighter | Install at freighter.app in the same browser you're using to open the app |
| `Account not found: G...` | Newly created wallet doesn't exist on testnet ledger yet | Fund via Friendbot — see Step 4 |
| `Bad union switch: 4` when calling the contract from the frontend | The `@stellar/stellar-sdk` version in `package.json` is too old to decode the current Protocol 23 transaction format on testnet | `npm install @stellar/stellar-sdk@latest` then restart `npm run dev` |
| `VITE_CONTRACT_ID is not configured` | Forgot to create/fill in the `.env` file | See Step 3 |

---

## Notes & possible extensions

- Since the original content never touches the chain, this is **not** a
  file storage service — if you want to keep a backup copy, upload the
  file to IPFS/Arweave and paste the link into "Reference link"
  (metadata_uri); the contract only stores that link, never the file
  content.
- Could issue a downloadable/printable PDF "certificate" (with the hash,
  transaction hash, and a QR code linking to the block explorer) — a good
  next step for the frontend.
- To deploy to mainnet: change `VITE_RPC_URL` to a mainnet RPC endpoint and
  `VITE_NETWORK_PASSPHRASE` to
  `"Public Global Stellar Network ; September 2015"`, then redeploy the
  contract with `--network mainnet`.
- The Soroban / `@stellar/stellar-sdk` ecosystem updates frequently; if you
  hit an unfamiliar error not listed in the Troubleshooting table, check
  your installed versions (`npm ls @stellar/stellar-sdk`, `stellar
  --version`) against the
  [official documentation](https://developers.stellar.org/docs).
