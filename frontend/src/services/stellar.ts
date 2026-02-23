import {
    Contract,
    SorobanRpc,
    TransactionBuilder,
    Networks,
    BASE_FEE,
    xdr,
    scValToNative,
    nativeToScVal,
    Address,
} from '@stellar/stellar-sdk';
import { STELLAR_CONFIG, getNetworkConfig } from '../config/stellar';
import type { TokenDeployParams, DeploymentResult, TokenInfo } from '../types';

export class StellarService {
    private server: SorobanRpc.Server;
    private networkPassphrase: string;
    private network: 'testnet' | 'mainnet';

    constructor(network: 'testnet' | 'mainnet' = 'testnet') {
        this.network = network;
        const config = getNetworkConfig(network);
        this.server = new SorobanRpc.Server(config.sorobanRpcUrl);
        this.networkPassphrase = config.networkPassphrase;
    }

    /**
     * Deploy a new token through the factory contract
     */
    async deployToken(params: TokenDeployParams, sourceAddress: string): Promise<DeploymentResult> {
        try {
            const contract = new Contract(STELLAR_CONFIG.factoryContractId);
            
            // Build contract invocation
            const operation = contract.call(
                'create_token',
                nativeToScVal(params.name, { type: 'string' }),
                nativeToScVal(params.symbol, { type: 'string' }),
                nativeToScVal(params.decimals, { type: 'u32' }),
                nativeToScVal(params.initialSupply, { type: 'i128' }),
                nativeToScVal(params.adminWallet, { type: 'address' }),
                nativeToScVal(this.calculateTotalFee(params), { type: 'i128' })
            );

            const account = await this.server.getAccount(sourceAddress);
            const transaction = new TransactionBuilder(account, {
                fee: BASE_FEE,
                networkPassphrase: this.networkPassphrase,
            })
                .addOperation(operation)
                .setTimeout(30)
                .build();

            // Simulate transaction
            const simulated = await this.server.simulateTransaction(transaction);
            if (SorobanRpc.Api.isSimulationError(simulated)) {
                throw new Error(`Simulation failed: ${simulated.error}`);
            }

            // Prepare transaction
            const prepared = SorobanRpc.assembleTransaction(transaction, simulated).build();

            return {
                tokenAddress: '', // Will be populated after signing and submission
                transactionHash: prepared.hash().toString('hex'),
                totalFee: this.calculateTotalFee(params).toString(),
                timestamp: Date.now(),
            };
        } catch (error) {
            throw this.handleError(error);
        }
    }

    /**
     * Mint additional tokens to a recipient address
     * @param tokenAddress - The address of the deployed token contract
     * @param recipient - The address to receive the minted tokens
     * @param amount - The amount of tokens to mint (as string to handle large numbers)
     * @param adminAddress - The admin address authorized to mint tokens
     * @returns Transaction hash
     */
    async mintTokens(
        tokenAddress: string,
        recipient: string,
        amount: string,
        adminAddress: string
    ): Promise<string> {
        try {
            // Validate inputs
            if (!tokenAddress || tokenAddress.trim() === '') {
                throw new Error('Token address is required');
            }
            if (!recipient || recipient.trim() === '') {
                throw new Error('Recipient address is required');
            }
            if (!adminAddress || adminAddress.trim() === '') {
                throw new Error('Admin address is required');
            }
            if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
                throw new Error('Invalid amount: must be a positive number');
            }

            // Create contract instance for the token
            const contract = new Contract(tokenAddress);
            
            // Calculate minting fee (assuming similar fee structure to deployment)
            const mintingFee = '1000000'; // 1 XLM in stroops, adjust as needed
            
            // Build contract invocation for mint_tokens
            const operation = contract.call(
                'mint_tokens',
                nativeToScVal(recipient, { type: 'address' }),
                nativeToScVal(amount, { type: 'i128' }),
                nativeToScVal(mintingFee, { type: 'i128' })
            );

            // Get admin account
            const account = await this.server.getAccount(adminAddress);
            
            // Build transaction
            const transaction = new TransactionBuilder(account, {
                fee: BASE_FEE,
                networkPassphrase: this.networkPassphrase,
            })
                .addOperation(operation)
                .setTimeout(30)
                .build();

            // Simulate transaction to validate
            const simulated = await this.server.simulateTransaction(transaction);
            if (SorobanRpc.Api.isSimulationError(simulated)) {
                // Check for authorization errors
                if (simulated.error.includes('unauthorized') || simulated.error.includes('auth')) {
                    throw new Error('Unauthorized: Admin authorization required for minting');
                }
                throw new Error(`Simulation failed: ${simulated.error}`);
            }

            // Prepare transaction
            const prepared = SorobanRpc.assembleTransaction(transaction, simulated).build();

            // Return transaction hash (caller will sign and submit)
            return prepared.hash().toString('hex');
        } catch (error) {
            if (error instanceof Error) {
                // Handle specific error cases
                if (error.message.includes('unauthorized') || error.message.includes('Unauthorized')) {
                    throw new Error('Unauthorized: Only the admin can mint tokens');
                }
                if (error.message.includes('Invalid amount')) {
                    throw error;
                }
                throw new Error(`Minting failed: ${error.message}`);
            }
            throw new Error('Minting failed: Unknown error');
        }
    }

    /**
     * Calculate total fee for token deployment
     */
    private calculateTotalFee(params: TokenDeployParams): number {
        const baseFee = 10000000; // 10 XLM base fee
        const metadataFee = params.metadata ? 5000000 : 0; // 5 XLM for metadata
        return baseFee + metadataFee;
    }

    /**
     * Handle and format errors
     */
    private handleError(error: unknown): Error {
        if (error instanceof Error) {
            return error;
        }
        return new Error('An unknown error occurred');
    }
}
