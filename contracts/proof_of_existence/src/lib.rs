#![no_std]

//! Proof of Existence contract
//!
//! Cho phép người sáng tạo nội dung (nhà văn, dev, nhạc sĩ, biên kịch,
//! founder...) "đóng dấu thời gian" cho một nội dung bằng cách đăng ký
//! hash (SHA-256) của nội dung đó lên blockchain Stellar.
//!
//! Nội dung KHÔNG bao giờ được upload lên chain — chỉ có hash (32 byte)
//! cùng với vài mét-dữ liệu (tiêu đề, link IPFS/URL tuỳ chọn) được lưu.
//! Vì vậy quyền riêng tư của nội dung gốc luôn được giữ nguyên, trong khi
//! timestamp của ledger Stellar chứng minh "nội dung này đã tồn tại vào
//! thời điểm này, do địa chỉ ví này gửi lên".

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, String, Vec};

#[contracttype]
#[derive(Clone)]
pub struct ProofRecord {
    pub id: u64,
    pub owner: Address,
    pub content_hash: BytesN<32>,
    pub title: String,
    pub metadata_uri: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Counter,
    Proof(u64),
    OwnerProofs(Address),
    HashIndex(BytesN<32>),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    ProofNotFound = 1,
    EmptyTitle = 2,
}

#[contract]
pub struct ProofOfExistenceContract;

#[contractimpl]
impl ProofOfExistenceContract {
    /// Đăng ký một proof-of-existence mới cho `content_hash`.
    ///
    /// - `owner` phải ký giao dịch (require_auth) — đây chính là "chủ sở hữu"
    ///   được ghi nhận trên chain.
    /// - Nếu `content_hash` đã được đăng ký từ trước (bởi bất kỳ ai), hàm sẽ
    ///   trả về id của proof gốc thay vì tạo bản ghi mới. Đây chính là điểm
    ///   mấu chốt của Proof-of-Existence: người nộp SỚM NHẤT giữ timestamp,
    ///   không ai có thể "ghi đè" hay giả mạo thời điểm sớm hơn.
    pub fn create_proof(
        env: Env,
        owner: Address,
        content_hash: BytesN<32>,
        title: String,
        metadata_uri: String,
    ) -> Result<u64, Error> {
        owner.require_auth();

        if title.len() == 0 {
            return Err(Error::EmptyTitle);
        }

        let hash_key = DataKey::HashIndex(content_hash.clone());
        if let Some(existing_id) = env.storage().instance().get::<DataKey, u64>(&hash_key) {
            return Ok(existing_id);
        }

        let mut counter: u64 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        counter += 1;

        let record = ProofRecord {
            id: counter,
            owner: owner.clone(),
            content_hash,
            title,
            metadata_uri,
            timestamp: env.ledger().timestamp(),
        };

        env.storage().instance().set(&DataKey::Proof(counter), &record);
        env.storage().instance().set(&hash_key, &counter);
        env.storage().instance().set(&DataKey::Counter, &counter);

        let mut owner_ids: Vec<u64> = env
            .storage()
            .instance()
            .get(&DataKey::OwnerProofs(owner.clone()))
            .unwrap_or(Vec::new(&env));
        owner_ids.push_back(counter);
        env.storage().instance().set(&DataKey::OwnerProofs(owner), &owner_ids);

        env.storage().instance().extend_ttl(500_000, 500_000);

        Ok(counter)
    }

    /// Lấy chi tiết một proof theo id.
    pub fn get_proof(env: Env, id: u64) -> Result<ProofRecord, Error> {
        env.storage().instance().get(&DataKey::Proof(id)).ok_or(Error::ProofNotFound)
    }

    /// Lấy danh sách id các proof mà một địa chỉ ví đã tạo.
    pub fn get_proofs_by_owner(env: Env, owner: Address) -> Vec<u64> {
        env.storage()
            .instance()
            .get(&DataKey::OwnerProofs(owner))
            .unwrap_or(Vec::new(&env))
    }

    /// Tra cứu proof theo hash nội dung — dùng để "xác minh" một file/văn bản
    /// có từng được đóng dấu thời gian hay chưa, và nếu có thì của ai, lúc nào.
    pub fn verify_by_hash(env: Env, content_hash: BytesN<32>) -> Option<ProofRecord> {
        let id = env
            .storage()
            .instance()
            .get::<DataKey, u64>(&DataKey::HashIndex(content_hash))?;
        env.storage().instance().get(&DataKey::Proof(id))
    }

    /// Tổng số proof đã được đăng ký trên contract.
    pub fn total_proofs(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }
}

mod test;
