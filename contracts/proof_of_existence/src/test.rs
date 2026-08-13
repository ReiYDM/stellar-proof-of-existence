#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;

fn hash32(env: &Env, seed: u8) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[0] = seed;
    BytesN::from_array(env, &bytes)
}

#[test]
fn test_create_and_get_proof() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProofOfExistenceContract, ());
    let client = ProofOfExistenceContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let hash = hash32(&env, 1);
    let title = String::from_str(&env, "My Song Demo v1");
    let metadata = String::from_str(&env, "ipfs://demo");

    let id = client.create_proof(&owner, &hash, &title, &metadata);
    assert_eq!(id, 1);

    let record = client.get_proof(&id);
    assert_eq!(record.owner, owner);
    assert_eq!(record.content_hash, hash);

    let owner_ids = client.get_proofs_by_owner(&owner);
    assert_eq!(owner_ids.len(), 1);

    assert_eq!(client.total_proofs(), 1);
}

#[test]
fn test_duplicate_hash_keeps_earliest_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProofOfExistenceContract, ());
    let client = ProofOfExistenceContractClient::new(&env, &contract_id);

    let owner1 = Address::generate(&env);
    let owner2 = Address::generate(&env);
    let hash = hash32(&env, 2);
    let title = String::from_str(&env, "Script draft");
    let metadata = String::from_str(&env, "");

    let id1 = client.create_proof(&owner1, &hash, &title, &metadata);
    let id2 = client.create_proof(&owner2, &hash, &title, &metadata);

    // Cùng một hash -> cùng một id -> chủ sở hữu đầu tiên được giữ nguyên.
    assert_eq!(id1, id2);
    let record = client.get_proof(&id1);
    assert_eq!(record.owner, owner1);
}

#[test]
fn test_verify_by_hash() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProofOfExistenceContract, ());
    let client = ProofOfExistenceContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let hash = hash32(&env, 3);
    let title = String::from_str(&env, "Startup pitch deck");
    let metadata = String::from_str(&env, "");

    client.create_proof(&owner, &hash, &title, &metadata);

    let found = client.verify_by_hash(&hash);
    assert!(found.is_some());
    assert_eq!(found.unwrap().owner, owner);

    let missing_hash = hash32(&env, 99);
    let not_found = client.verify_by_hash(&missing_hash);
    assert!(not_found.is_none());
}

#[test]
fn test_empty_title_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(ProofOfExistenceContract, ());
    let client = ProofOfExistenceContractClient::new(&env, &contract_id);

    let owner = Address::generate(&env);
    let hash = hash32(&env, 4);
    let empty_title = String::from_str(&env, "");
    let metadata = String::from_str(&env, "");

    let result = client.try_create_proof(&owner, &hash, &empty_title, &metadata);
    assert!(result.is_err());
}
