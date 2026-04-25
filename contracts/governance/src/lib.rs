//! Governance Delegation System — Contract Entry Point
//!
//! This Soroban smart contract implements vote-power delegation for
//! the Nova Launch governance system.
//!
//! # Overview
//!
//! Token holders can delegate their vote power to any other address.
//! Delegated vote power is transferred atomically and can be revoked
//! at any time.  Historical snapshots allow proposals to fix vote power
//! at a specific ledger, preventing manipulation.
//!
//! # Public interface
//!
//! | Function              | Description                                      |
//! |----------------------|--------------------------------------------------|
//! | `initialize`         | One-time setup: admin, initial balances          |
//! | `delegate`           | Delegate vote power to another address           |
//! | `undelegate`         | Revoke current delegation                        |
//! | `get_vote_power`     | Query current vote power of an address           |
//! | `get_delegation`     | Query active delegation record                   |
//! | `take_snapshot`      | Snapshot vote power at current ledger            |
//! | `get_snapshot_power` | Query historical vote power at a ledger          |
//! | `set_balance`        | Admin: update a holder's token balance           |
//! | `transfer_admin`     | Transfer admin rights                            |
//! | `pause` / `unpause`  | Emergency circuit-breaker                        |
//!
//! # Security
//!
//! - All mutating functions require `require_auth()` (OWASP A01)
//! - Circular delegation is detected and rejected (OWASP A04)
//! - All arithmetic is checked (OWASP A03)
//! - Pause mechanism for emergency response (OWASP A05)

#![no_std]

mod delegation;
mod events;
mod storage;
mod types;

use soroban_sdk::{contract, contractimpl, Address, Env};
use types::{DelegationRecord, Error};

#[contract]
pub struct GovernanceContract;

#[contractimpl]
impl GovernanceContract {
    // ─── Lifecycle ─────────────────────────────────────────────────────────

    /// Initialize the governance contract.
    ///
    /// Must be called exactly once after deployment.  Sets the admin and
    /// records the total token supply used for vote-power calculations.
    ///
    /// # Arguments
    /// * `admin`        - Address that can manage the contract
    /// * `total_supply` - Total token supply (must be > 0)
    ///
    /// # Errors
    /// * `AlreadyInitialized` - Contract has already been set up
    /// * `InvalidParameters`  - total_supply is zero or negative
    pub fn initialize(env: Env, admin: Address, total_supply: i128) -> Result<(), Error> {
        if storage::has_admin(&env) {
            return Err(Error::AlreadyInitialized);
        }
        if total_supply <= 0 {
            return Err(Error::InvalidParameters);
        }

        storage::set_admin(&env, &admin);
        storage::set_total_supply(&env, total_supply);

        Ok(())
    }

    // ─── Delegation ────────────────────────────────────────────────────────

    /// Delegate the caller's vote power to `delegatee`.
    ///
    /// If the caller already has an active delegation, this atomically
    /// re-delegates from the old delegatee to the new one.
    ///
    /// # Errors
    /// * `InvalidParameters`  - Self-delegation attempted
    /// * `CircularDelegation` - Would create a cycle (A→B→A)
    /// * `InsufficientBalance`- Caller has zero balance
    /// * `ContractPaused`     - Contract is paused
    pub fn delegate(env: Env, delegator: Address, delegatee: Address) -> Result<(), Error> {
        delegation::delegate(&env, delegator, delegatee)
    }

    /// Revoke the caller's current delegation.
    ///
    /// Vote power is returned to the caller immediately.
    ///
    /// # Errors
    /// * `NotFound`       - Caller has no active delegation
    /// * `ContractPaused` - Contract is paused
    pub fn undelegate(env: Env, delegator: Address) -> Result<(), Error> {
        delegation::undelegate(&env, delegator)
    }

    // ─── Queries ───────────────────────────────────────────────────────────

    /// Return the current vote power of `address`.
    pub fn get_vote_power(env: Env, address: Address) -> i128 {
        delegation::get_vote_power(&env, &address)
    }

    /// Return the active delegation record for `delegator`, if any.
    pub fn get_delegation(env: Env, delegator: Address) -> Option<DelegationRecord> {
        delegation::get_delegation(&env, &delegator)
    }

    /// Return the raw token balance of `holder`.
    pub fn get_balance(env: Env, holder: Address) -> i128 {
        storage::get_balance(&env, &holder)
    }

    // ─── Snapshots ─────────────────────────────────────────────────────────

    /// Take a snapshot of `address`'s vote power at the current ledger.
    ///
    /// Snapshots are used by governance proposals to fix vote power at a
    /// specific point in time.
    pub fn take_snapshot(env: Env, address: Address) -> Result<(), Error> {
        delegation::take_snapshot(&env, &address)
    }

    /// Query the vote power of `address` at a specific past `ledger`.
    ///
    /// # Errors
    /// * `SnapshotNotFound` - No snapshot exists for that ledger
    pub fn get_snapshot_power(env: Env, address: Address, ledger: u32) -> Result<i128, Error> {
        delegation::get_snapshot_power(&env, &address, ledger)
    }

    // ─── Admin: balance management ─────────────────────────────────────────

    /// Set the token balance for `holder` (admin only).
    ///
    /// Also initialises the holder's vote power to their balance if they
    /// have no active delegation.  This is the mechanism by which the
    /// off-chain token contract syncs balances to the governance contract.
    ///
    /// # Security
    /// Only the admin can call this function.
    pub fn set_balance(
        env: Env,
        admin: Address,
        holder: Address,
        new_balance: i128,
    ) -> Result<(), Error> {
        if storage::is_paused(&env) {
            return Err(Error::ContractPaused);
        }

        admin.require_auth();

        let stored_admin = storage::get_admin(&env);
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        if new_balance < 0 {
            return Err(Error::InvalidParameters);
        }

        let old_balance = storage::get_balance(&env, &holder);
        let delta = new_balance
            .checked_sub(old_balance)
            .ok_or(Error::ArithmeticError)?;

        storage::set_balance(&env, &holder, new_balance);

        // Propagate the balance delta to vote power.
        // If holder has delegated, adjust the delegatee's power.
        // Otherwise adjust the holder's own power.
        if let Some(ref record) = storage::get_delegation(&env, &holder) {
            let delegatee = record.delegatee.clone();
            let current_power = storage::get_vote_power(&env, &delegatee);
            let new_power = current_power
                .checked_add(delta)
                .ok_or(Error::ArithmeticError)?;
            storage::set_vote_power(&env, &delegatee, new_power.max(0));
        } else {
            let current_power = storage::get_vote_power(&env, &holder);
            let new_power = current_power
                .checked_add(delta)
                .ok_or(Error::ArithmeticError)?;
            storage::set_vote_power(&env, &holder, new_power.max(0));
        }

        Ok(())
    }

    // ─── Admin: contract management ────────────────────────────────────────

    /// Transfer admin rights to `new_admin`.
    ///
    /// # Errors
    /// * `Unauthorized`      - Caller is not the current admin
    /// * `InvalidParameters` - new_admin is the same as current admin
    pub fn transfer_admin(
        env: Env,
        current_admin: Address,
        new_admin: Address,
    ) -> Result<(), Error> {
        current_admin.require_auth();

        let stored_admin = storage::get_admin(&env);
        if current_admin != stored_admin {
            return Err(Error::Unauthorized);
        }
        if new_admin == current_admin {
            return Err(Error::InvalidParameters);
        }

        storage::set_admin(&env, &new_admin);
        events::emit_admin_transfer(&env, &current_admin, &new_admin);

        Ok(())
    }

    /// Pause the contract (admin only).
    ///
    /// While paused, `delegate`, `undelegate`, and `set_balance` are disabled.
    pub fn pause(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();

        let stored_admin = storage::get_admin(&env);
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        storage::set_paused(&env, true);
        events::emit_pause_changed(&env, &admin, true);

        Ok(())
    }

    /// Unpause the contract (admin only).
    pub fn unpause(env: Env, admin: Address) -> Result<(), Error> {
        admin.require_auth();

        let stored_admin = storage::get_admin(&env);
        if admin != stored_admin {
            return Err(Error::Unauthorized);
        }

        storage::set_paused(&env, false);
        events::emit_pause_changed(&env, &admin, false);

        Ok(())
    }

    /// Return whether the contract is currently paused.
    pub fn is_paused(env: Env) -> bool {
        storage::is_paused(&env)
    }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

#[cfg(test)]
mod governance_test;

#[cfg(test)]
mod governance_property_test;
