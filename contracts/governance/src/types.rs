//! Governance Delegation System — Type Definitions
//!
//! Defines all on-chain data structures, storage keys, and error codes
//! used by the governance delegation contract.

#![allow(dead_code)]

use soroban_sdk::{contracttype, contracterror, Address};

// ─── Storage keys ──────────────────────────────────────────────────────────

/// Discriminated union of every key written to contract storage.
///
/// Using a typed enum prevents key collisions and makes storage
/// access self-documenting.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Contract admin address (instance storage)
    Admin,
    /// Whether the contract is paused (instance storage)
    Paused,
    /// Total token supply snapshot used for vote-power calculation (instance)
    TotalSupply,
    /// Holder's raw token balance: Balance(holder)
    Balance(Address),
    /// Who `delegator` has delegated their vote power to: Delegate(delegator)
    Delegate(Address),
    /// Accumulated vote power of `delegatee` (sum of all delegators + own balance)
    /// VotePower(delegatee)
    VotePower(Address),
    /// Nonce for replay-protection on delegation signatures: Nonce(address)
    Nonce(Address),
    /// Snapshot of vote power at a given ledger: Snapshot(address, ledger_seq)
    Snapshot(Address, u32),
}

// ─── On-chain structs ──────────────────────────────────────────────────────

/// A single delegation record stored on-chain.
///
/// Records who delegated to whom and when, enabling full audit trails.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DelegationRecord {
    /// The address that is delegating its vote power
    pub delegator: Address,
    /// The address receiving the delegated vote power
    pub delegatee: Address,
    /// Ledger sequence number when the delegation was created/updated
    pub since_ledger: u32,
}

/// A historical vote-power snapshot for a given address at a ledger.
///
/// Used to query vote power at a past point in time (e.g. for proposal
/// eligibility checks that must use a fixed snapshot).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct VotePowerSnapshot {
    /// The address whose vote power is recorded
    pub address: Address,
    /// Ledger sequence at which this snapshot was taken
    pub ledger: u32,
    /// Vote power at that ledger
    pub power: i128,
}

// ─── Error codes ───────────────────────────────────────────────────────────

#[contracterror]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Error {
    /// Contract has already been initialized
    AlreadyInitialized = 1,
    /// Caller is not authorized to perform this action
    Unauthorized = 2,
    /// One or more parameters are invalid (zero amount, self-delegation, etc.)
    InvalidParameters = 3,
    /// The requested address or record was not found
    NotFound = 4,
    /// Arithmetic overflow or underflow detected
    ArithmeticError = 5,
    /// Contract is paused; write operations are disabled
    ContractPaused = 6,
    /// Delegation chain would exceed the maximum allowed depth
    DelegationChainTooDeep = 7,
    /// Delegator has insufficient balance to delegate
    InsufficientBalance = 8,
    /// Circular delegation detected (A→B→A)
    CircularDelegation = 9,
    /// Snapshot not found for the requested ledger
    SnapshotNotFound = 10,
}
