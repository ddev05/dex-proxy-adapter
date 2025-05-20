import { Connection, PublicKey, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { PoolReserves } from "../types";
import { IDexReadAdapter } from "../utils/iAdapter";
import { AccountLayout, MintLayout, NATIVE_MINT, getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createPumpswapBuyIx, createPumpswapSellIx, parsePool, PUMPSWAP_DEVNET_FEE_ADDR, PUMPSWAP_EVENT_AUTH, PUMPSWAP_GLOBAL_CONFIG, PUMPSWAP_MAINNET_FEE_ADDR, PUMPSWAP_POOL, PUMPSWAP_PROGRAM_ADDR, PumpSwapAccount, PumpSwapKeys, PumpSwapPoolInfo } from "./src";
import { BONDING_CURVE_SEED, parseBondingCurve, PumpBondingCurveInfo, PUMPFUN_POOL_AUTH, PUMPFUN_PROGRAM_ID } from "../pumpfun/src";

export class PumpSwapAdapter implements IDexReadAdapter {
    private connection: Connection;
    private cluster: "mainnet" | "devnet";

    public lpFeeBasisPoints: number = 20;
    public protocolFeeBasisPoints: number = 5;
    private poolInfo: PumpSwapPoolInfo | null

    private constructor(
        connection: Connection,
        cluster: "mainnet" | "devnet",
        poolInfo: PumpSwapPoolInfo | null
    ) {
        this.connection = connection;
        this.cluster = cluster;
        this.poolInfo = poolInfo;
    }

    static async create(connection: Connection, poolAddress: string, cluster: "mainnet" | "devnet" = "mainnet") {
        const poolId = new PublicKey(poolAddress);

        let poolInfo: PumpSwapPoolInfo | null = null;
        const data = await connection.getAccountInfo(poolId);
        if (data) {
            poolInfo = parsePool(data.data);
        }

        return new PumpSwapAdapter(connection, cluster, poolInfo);
    }

    static async getPoolsFromCa(connection: Connection, mintAddr: PublicKey, payer: PublicKey, index = 0): Promise<PumpSwapKeys> {
        const baseMint = mintAddr, quoteMint = NATIVE_MINT;

        const [creator] = PublicKey.findProgramAddressSync([Buffer.from(PUMPFUN_POOL_AUTH), mintAddr.toBuffer()], PUMPFUN_PROGRAM_ID)

        const buffer = Buffer.alloc(2); // 2 bytes for u16
        buffer.writeUInt16LE(index);

        const [pool] = PublicKey.findProgramAddressSync([
            Buffer.from(PUMPSWAP_POOL),                    // const seed
            buffer,     // index seed
            creator.toBuffer(),                    // creator pubkey
            baseMint.toBuffer(),                   // base mint pubkey
            quoteMint.toBuffer()                   // quote mint pubkey
        ], PUMPSWAP_PROGRAM_ADDR)
        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(PUMPSWAP_GLOBAL_CONFIG)], PUMPSWAP_PROGRAM_ADDR)
        const [eventAuthority] = PublicKey.findProgramAddressSync([Buffer.from(PUMPSWAP_EVENT_AUTH)], PUMPSWAP_PROGRAM_ADDR)

        const poolBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, pool, true)
        const poolQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, pool, true)
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, payer)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, payer)

        const protocolFeeRecipient = PUMPSWAP_MAINNET_FEE_ADDR[0]
        const protocolFeeRecipientTokenAccount = getAssociatedTokenAddressSync(NATIVE_MINT, protocolFeeRecipient, true);

        return {
            pool,
            user: payer,
            globalConfig,
            baseMint,
            quoteMint,
            userBaseTokenAccount,
            userQuoteTokenAccount,
            poolBaseTokenAccount,
            poolQuoteTokenAccount,
            protocolFeeRecipient,
            protocolFeeRecipientTokenAccount,
            baseTokenProgram: TOKEN_PROGRAM_ID,
            quoteTokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            eventAuthority,
            programId: PUMPSWAP_PROGRAM_ADDR,
        }
    }

    getPoolKeys(): PumpSwapPoolInfo | null {
        return this.poolInfo;
    }

    async getPoolReserves(
    ): Promise<PoolReserves> {
        try {
            if (!this.poolInfo || !this.poolInfo?.pool_base_token_account || !this.poolInfo?.pool_quote_token_account) return {
                //  @ts-ignore
                token0: this.poolInfo.baseMint.toBase58(),
                //  @ts-ignore
                token1: this.poolInfo.quoteMint.toBase58(),
                reserveToken0: 0,
                reserveToken1: 0,
            }

            const [baseVaultData, quoteVaultData] = await this.connection.getMultipleAccountsInfo([
                this.poolInfo.pool_base_token_account,
                this.poolInfo.pool_quote_token_account,
            ]);

            if (!baseVaultData || !quoteVaultData) {
                return {
                    token0: this.poolInfo.pool_base_token_account.toBase58(),
                    token1: this.poolInfo.pool_quote_token_account.toBase58(),
                    reserveToken0: 0,
                    reserveToken1: 0
                };
            }

            const baseVaultDecoded = AccountLayout.decode(baseVaultData.data);
            const quoteVaultDecoded = AccountLayout.decode(quoteVaultData.data);

            return {
                token0: this.poolInfo.base_mint.toBase58(),
                token1: this.poolInfo.quote_mint.toBase58(),
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
            this.poolInfo.base_mint,
            this.poolInfo.quote_mint
        ]);

        if (!baseMintInfo || !quoteMintInfo) return 0;

        const baseMintParsedInfo = MintLayout.decode(baseMintInfo.data);
        const quoteMintParsedInfo = MintLayout.decode(quoteMintInfo.data);

        const reserveUIBase = reserveBase / 10 ** baseMintParsedInfo.decimals;
        const reserveUIQuote = reserveQuote / 10 ** quoteMintParsedInfo.decimals;

        if (this.poolInfo.quote_mint.toBase58() == NATIVE_MINT.toBase58()) {
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
        swapAccountkey: PumpSwapAccount
    ): TransactionInstruction {
        const {
            baseMint,
            baseTokenProgram,
            inputMint,
            pool,
            quoteMint,
            quoteTokenProgram,
            user
        } = swapAccountkey

        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(PUMPSWAP_GLOBAL_CONFIG)], PUMPSWAP_PROGRAM_ADDR)
        const [eventAuthority] = PublicKey.findProgramAddressSync([Buffer.from(PUMPSWAP_EVENT_AUTH)], PUMPSWAP_PROGRAM_ADDR)

        const protocolFeeRecipient = this.cluster == "mainnet" ? PUMPSWAP_MAINNET_FEE_ADDR[0] : PUMPSWAP_DEVNET_FEE_ADDR[0]
        const protocolFeeRecipientTokenAccount = getAssociatedTokenAddressSync(NATIVE_MINT, protocolFeeRecipient, true);

        const poolBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, pool, true)
        const poolQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, pool, true)
        const userBaseTokenAccount = getAssociatedTokenAddressSync(baseMint, user)
        const userQuoteTokenAccount = getAssociatedTokenAddressSync(quoteMint, user)

        let ix: TransactionInstruction;

        if (inputMint.toBase58() === this.poolInfo?.quote_mint.toBase58()) {
            ix = createPumpswapBuyIx({
                programId: PUMPSWAP_PROGRAM_ADDR,
                maxQuoteAmountIn: amountIn,
                baseAmountOut: amountOut,
                globalConfig,
                eventAuthority,
                protocolFeeRecipient,
                protocolFeeRecipientTokenAccount,
                baseMint,
                quoteMint,
                pool,
                poolBaseTokenAccount,
                poolQuoteTokenAccount,
                userBaseTokenAccount,
                userQuoteTokenAccount,
                user,
                baseTokenProgram,
                quoteTokenProgram,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
        } else {
            ix = createPumpswapSellIx({
                programId: PUMPSWAP_PROGRAM_ADDR,
                baseAmountIn: amountIn,
                minQuoteAmountOut: amountOut,
                globalConfig,
                eventAuthority,
                protocolFeeRecipient,
                protocolFeeRecipientTokenAccount,
                baseMint,
                quoteMint,
                pool,
                poolBaseTokenAccount,
                poolQuoteTokenAccount,
                userBaseTokenAccount,
                userQuoteTokenAccount,
                user,
                baseTokenProgram,
                quoteTokenProgram,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
        }

        return ix;
    }
}