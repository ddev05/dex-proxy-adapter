import { Connection, PublicKey, Keypair, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { PoolReserves } from "../types";
import { IDexReadAdapter } from "../utils/iAdapter";
import { AccountLayout, Account, MintLayout, NATIVE_MINT, getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { MeteoraPoolInfo, MeteoraSwapAccount, parsePoolAccount, VAULT_WITH_NON_PDA_BASED_LP_MINT } from "./src";
import { LP_MINT_PREFIX, METEORA_PROGRAM_ADDR, METEORA_VAULT_PROGRAM, TOKEN_VAULT_PREFIX, createMeteoraSwapInstruction } from "./src";

export class MeteoraDynAdapter implements IDexReadAdapter {
    private connection: Connection;
    private cluster: "mainnet" | "devnet";

    private poolInfo: MeteoraPoolInfo | null
    private pool: PublicKey;

    private constructor(
        connection: Connection,
        cluster: "mainnet" | "devnet",
        poolInfo: MeteoraPoolInfo | null,
        pool: PublicKey
    ) {
        this.connection = connection;
        this.cluster = cluster;
        this.pool = pool;
        this.poolInfo = poolInfo;
    }

    static async create(connection: Connection, poolAddress: string, cluster: "mainnet" | "devnet" = "mainnet") {
        const poolId = new PublicKey(poolAddress);

        let poolInfo: MeteoraPoolInfo | null = null;
        const data = await connection.getAccountInfo(poolId);
        if (data) {
            poolInfo = parsePoolAccount(data.data);
        }

        return new MeteoraDynAdapter(connection, cluster, poolInfo, poolId);
    }

    getPoolKeys(): MeteoraPoolInfo | null {
        return this.poolInfo;
    }

    async getPoolReserves(
    ): Promise<PoolReserves> {
        try {
            if (!this.poolInfo || !this.poolInfo?.aVault || !this.poolInfo?.bVault) return {
                //  @ts-ignore
                token0: this.poolInfo.baseMint.toBase58(),
                //  @ts-ignore
                token1: this.poolInfo.quoteMint.toBase58(),
                reserveToken0: 0,
                reserveToken1: 0,
            }

            const [baseVaultData, quoteVaultData] = await this.connection.getMultipleAccountsInfo([
                this.poolInfo.aVaultLp,
                this.poolInfo.bVaultLp,
            ]);

            if (!baseVaultData || !quoteVaultData) {
                return {
                    token0: this.poolInfo.aVault.toBase58(),
                    token1: this.poolInfo.bVault.toBase58(),
                    reserveToken0: 0,
                    reserveToken1: 0
                };
            }

            const baseVaultDecoded = AccountLayout.decode(baseVaultData.data);
            const quoteVaultDecoded = AccountLayout.decode(quoteVaultData.data);

            return {
                token0: this.poolInfo.tokenAMint.toBase58(),
                token1: this.poolInfo.tokenBMint.toBase58(),
                reserveToken0: Number(baseVaultDecoded.amount),
                reserveToken1: Number(quoteVaultDecoded.amount),
            };
        } catch (err) {
            console.error("Failed to fetch pool reserves:", err);
            return {
                token0: "",
                token1: "",
                reserveToken0: 0,
                reserveToken1: 0
            };
        }
    }

    async getPrice(reserve: PoolReserves): Promise<number> {
        const { reserveToken0: reserveBase, reserveToken1: reserveQuote } = reserve;

        if (!this.poolInfo) return 0;

        const [baseMintInfo, quoteMintInfo] = await this.connection.getMultipleAccountsInfo([
            this.poolInfo.tokenAMint,
            this.poolInfo.tokenBMint
        ]);

        if (!baseMintInfo || !quoteMintInfo) return 0;

        const baseMintParsedInfo = MintLayout.decode(baseMintInfo.data);
        const quoteMintParsedInfo = MintLayout.decode(quoteMintInfo.data);

        const reserveUIBase = reserveBase / 10 ** baseMintParsedInfo.decimals;
        const reserveUIQuote = reserveQuote / 10 ** quoteMintParsedInfo.decimals;

        if (this.poolInfo.tokenAMint.toBase58() != NATIVE_MINT.toBase58()) {
            return reserveUIQuote / reserveUIBase;
        } else {
            return reserveUIBase / reserveUIQuote;
        }
    }

    getSwapQuote(baseAmountIn: number, inputMint: string, reserve: PoolReserves, slippage: number = 0): number {
        let reserveIn: number, reserveOut: number;

        if (inputMint === reserve.token0) {
            reserveIn = reserve.reserveToken0, reserveOut = reserve.reserveToken1;

            let amountOut = Math.floor(reserveOut / (reserveIn + baseAmountIn) * baseAmountIn) - 1

            const amountOutWithFee = Math.floor(amountOut * 0.9975)
            const amountOutWithFeeSlippage = Math.floor(amountOutWithFee * (1 - slippage / 100))

            return amountOutWithFeeSlippage
        }
        else {
            reserveOut = reserve.reserveToken0, reserveIn = reserve.reserveToken1
            const sol_reserve = BigInt(reserveIn);
            const token_reserve = BigInt(reserveOut);

            const product = sol_reserve * token_reserve;

            let new_sol_reserve = sol_reserve + BigInt(baseAmountIn - 1) * BigInt(10000) / BigInt(10025);

            let new_token_reserve = product / new_sol_reserve + BigInt(1);
            let amount_to_be_purchased = token_reserve - new_token_reserve;

            return Number(amount_to_be_purchased)
        }
    }

    getSwapInstruction(
        amountIn: number,
        amountOut: number,
        swapAccountkey: MeteoraSwapAccount
    ): TransactionInstruction {

        if (!this.poolInfo) throw new Error("Pool Info is not loaded yet")
        const { inputMint, user } = swapAccountkey
        const { aVault, aVaultLp, bVault, bVaultLp, protocolTokenBFee } = this.poolInfo
        const [aTokenVault] = PublicKey.findProgramAddressSync([Buffer.from(TOKEN_VAULT_PREFIX), aVault.toBuffer()], METEORA_VAULT_PROGRAM)
        const [bTokenVault] = PublicKey.findProgramAddressSync([Buffer.from(TOKEN_VAULT_PREFIX), bVault.toBuffer()], METEORA_VAULT_PROGRAM)

        console.log()

        const [aVaultLpMint] = VAULT_WITH_NON_PDA_BASED_LP_MINT[aVault.toBase58()] == undefined ? PublicKey.findProgramAddressSync([Buffer.from(LP_MINT_PREFIX), aVault.toBuffer()], METEORA_VAULT_PROGRAM) : [VAULT_WITH_NON_PDA_BASED_LP_MINT[aVault.toBase58()]];
        const [bVaultLpMint] = VAULT_WITH_NON_PDA_BASED_LP_MINT[bVault.toBase58()] == undefined ? PublicKey.findProgramAddressSync([Buffer.from(LP_MINT_PREFIX), bVault.toBuffer()], METEORA_VAULT_PROGRAM) : [VAULT_WITH_NON_PDA_BASED_LP_MINT[bVault.toBase58()]];

        const outputMint = this.poolInfo.tokenAMint == inputMint ? this.poolInfo.tokenBMint : this.poolInfo.tokenAMint

        const userSourceToken = getAssociatedTokenAddressSync(inputMint, user)
        const userDestinationToken = getAssociatedTokenAddressSync(outputMint, user)

        console.log({
            programId: METEORA_PROGRAM_ADDR,
            pool: this.pool,
            userSourceToken,
            userDestinationToken,
            aVault,
            bVault,
            aTokenVault,
            bTokenVault,
            aVaultLpMint,
            bVaultLpMint,
            aVaultLp,
            bVaultLp,
            protocolTokenFee: protocolTokenBFee,
            user,
            vaultProgram: METEORA_VAULT_PROGRAM,
            tokenProgram: TOKEN_PROGRAM_ID,
            inAmount: amountIn,
            minimumOutAmount: amountOut,
        });


        const ix = createMeteoraSwapInstruction(
            {
                programId: METEORA_PROGRAM_ADDR,
                pool: this.pool,
                userSourceToken,
                userDestinationToken,
                aVault,
                bVault,
                aTokenVault,
                bTokenVault,
                aVaultLpMint,
                bVaultLpMint,
                aVaultLp,
                bVaultLp,
                protocolTokenFee: protocolTokenBFee,
                user,
                vaultProgram: METEORA_VAULT_PROGRAM,
                tokenProgram: TOKEN_PROGRAM_ID,
                inAmount: amountIn,
                minimumOutAmount: amountOut,
            }
        )

        return ix;
    }
}