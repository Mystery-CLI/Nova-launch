//! Governance Delegation System — Storage Layer
//!
//! All contract state reads and writes are centralised here.
//! This keeps `lib.rs` and `delegation.rs` free of raw storage calls
//! and makes the storage layout easy to audit.

use soroban_sdk::{Address, Env};
use crate::types::{DataKey, DelegationRecord, VotePowerSnapshot};

// ─── Admin ─────────────────────────────────────────────────────────────────

pub fn get_admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn has_admin(env: &Env) -> bool {
    env.storage().instance().has(&DataKey::Admin)
}

// ─── Pause ─────────────────────────────────────────────────────────────────

pub fn is_paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}

pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
}

// ─── Total supply ──────────────────────────────────────────────────────────

pub fn get_total_supply(env: &Env) -> i128 {
    env.storage()
        .instance()
        .get(&DataKey::TotalSupply)
        .unwrap_or(0)
}

pub fn set_total_supply(env: &Env, supply: i128) {
    env.storage().instance().set(&DataKey::TotalSupply, &supply);
}

// ─── Balances ──────────────────────────────────────────────────────────────

/// Return the raw token balance for `holder` (0 if never set).
pub fn get_balance(env: &Env, holder: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::Balance(holder.clone()))
        .unwrap_or(0)
}

pub fn set_balance(env: &Env, holder: &Address, balance: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::Balance(holder.clone()), &balance);
}

// ─── Delegation records ────────────────────────────────────────────────────

/// Return the current delegation record for `delegator`, if any.
pub fn get_delegation(env: &Env, delegator: &Address) -> Option<DelegationRecord> {
    env.storage()
        .persistent()
        .get(&DataKey::Delegate(delegator.clone()))
}

pub fn set_delegation(env: &Env, delegator: &Address, record: &DelegationRecord) {
    env.storage()
        .persistent()
        .set(&DataKey::Delegate(delegator.clone()), record);
}

pub fn remove_delegation(env: &Env, delegator: &Address) {
    env.storage()
        .persistent()
        .remove(&DataKey::Delegate(delegator.clone()));
}

// ─── Vote power ────────────────────────────────────────────────────────────

/// Return the accumulated vote power for `delegatee` (0 if none).
pub fn get_vote_power(env: &Env, delegatee: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::VotePower(delegatee.clone()))
        .unwrap_or(0)
}

pub fn set_vote_power(env: &Env, delegatee: &Address, power: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::VotePower(delegatee.clone()), &power);
}

// ─── Nonces (replay protection) ────────────────────────────────────────────

pub fn get_nonce(env: &Env, address: &Address) -> u64 {
    env.storage()
        .persistent()
        .get(&DataKey::Nonce(address.clone()))
        .unwrap_or(0)
}

pub fn increment_nonce(env: &Env, address: &Address) -> u64 {
    let next = get_nonce(env, address) + 1;
    env.storage()
        .persistent()
        .set(&DataKey::Nonce(address.clone()), &next);
    next
}

// ─── Vote-power snapshots ──────────────────────────────────────────────────

/// Store a snapshot of `address`'s vote power at `ledger`.
pub fn set_snapshot(env: &Env, address: &Address, ledger: u32, power: i128) {
    let snap = VotePowerSnapshot {
        address: address.clone(),
        ledger,
        power,
    };
    env.storage()
        .persistent()
        .set(&DataKey::Snapshot(address.clone(), ledger), &snap);
}

/// Retrieve a previously stored snapshot.
pub fn get_snapshot(env: &Env, address: &Address, ledger: u32) -> Option<VotePowerSnapshot> {
    env.storage()
        .persistent()
        .get(&DataKey::Snapshot(address.clone(), ledger))
}
