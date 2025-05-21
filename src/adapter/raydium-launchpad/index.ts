import { Connection, PublicKey, Keypair, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { PoolReserves } from "../types";
import { IDexReadAdapter } from "../utils/iAdapter";
import { AccountLayout, getAssociatedTokenAddressSync, getMultipleAccounts, MintLayout, NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";

import { buyExactInIx, calculateFee, getAmountOut, GlobalConfigAccount, LAUNCHPAD_AUTH_SEED, LAUNCHPAD_POOL_EVENT_AUTH_SEED, parseGlobalConfigAccount, parsePlatformConfigAccount, parsePoolStateAccount, PlatformConfigAccount, PoolStateAccount, RAYDIUM_LAUNCHLAB_MAINNET_ADDR, RaydiumLaunchPadAccountKeys, sellExactInIx } from "./src";
import BigNumber from "bignumber.js";
import { FEE_RATE_DENOMINATOR_VALUE } from "../pumpfun/src";

export class RaydiumLaunchlabAdapter implements IDexReadAdapter {
    private connection: Connection;
    private cluster: "mainnet" | "devnet";
    private poolId: PublicKey;
    private poolInfo: PoolStateAccount;

    private globalConfig: GlobalConfigAccount;
    private platformConfig: PlatformConfigAccount;

    private constructor(
        connection: Connection,
        poolId: PublicKey,
        poolInfo: PoolStateAccount,
        globalConfig: GlobalConfigAccount,
        platformConfig: PlatformConfigAccount,
        cluster: "mainnet" | "devnet",
    ) {
        this.connection = connection;
        this.poolInfo = poolInfo;
        this.poolId = poolId;
        this.cluster = cluster;
        this.globalConfig = globalConfig
        this.platformConfig = platformConfig
    }

    static async create(connection: Connection, poolAddress: string, cluster: "mainnet" | "devnet" = "mainnet") {
        const poolId = new PublicKey(poolAddress);

        const poolRawData = await connection.getAccountInfo(poolId)

        if (!poolRawData) throw new Error("Error in Fetching Data")

        const poolData = parsePoolStateAccount(poolRawData.data)

        const [globalConfig, platformConfig] = await connection.getMultipleAccountsInfo([poolData.globalConfig, poolData.platformConfig])

        if (!globalConfig || !platformConfig) throw new Error("Error in getting config info")
        const globalConfigParsed = parseGlobalConfigAccount(globalConfig.data)
        const platformConfigParsed = parsePlatformConfigAccount(platformConfig.data)

        return new RaydiumLaunchlabAdapter(connection, poolId, poolData, globalConfigParsed, platformConfigParsed, cluster)
    }

    getPoolKeys(): PoolStateAccount | null {
        return this.poolInfo
    }

    async getPoolReserves(
    ): Promise<PoolReserves> {
        const poolRawData = await this.connection.getAccountInfo(this.poolId)

        if (!poolRawData) throw new Error("Error in Fetching Data")

        this.poolInfo = parsePoolStateAccount(poolRawData.data)

        const { baseMint, quoteMint, virtualBase, virtualQuote } = this.poolInfo;
        return {
            token0: baseMint.toString(),
            token1: quoteMint.toString(),
            reserveToken0: virtualBase.toNumber(),
            reserveToken1: virtualQuote.toNumber(),
        }
    }

    async getPrice(): Promise<number> {
        const { virtualBase, virtualQuote, realBase, realQuote, baseDecimals, quoteDecimals } = this.poolInfo

        return virtualQuote.plus(realQuote).div(virtualBase.minus(realBase)).times(10 ** (baseDecimals - quoteDecimals)).toNumber()
    }

    getSwapQuote(baseAmountIn: number, inputMint: string, reserve: PoolReserves | null, slippage: number = 0): number {
        const { virtualBase, virtualQuote, realBase, realQuote, baseDecimals, quoteDecimals } = this.poolInfo;

        const feeRate = this.globalConfig.tradeFeeRate.plus(this.platformConfig.feeRate)

        const fee = calculateFee({ amount: BigNumber(baseAmountIn), feeRate });

        const amountLessFeeB = BigNumber(baseAmountIn).minus(fee);

        let amountOut: number;
        if (inputMint == NATIVE_MINT.toBase58()) {
            amountOut = getAmountOut({
                amountIn: BigNumber(baseAmountIn).minus(fee),
                inputReserve: virtualQuote.plus(realQuote),
                outputReserve: virtualBase.minus(realBase),
            }).toNumber();
        } else {
            amountOut = getAmountOut({
                amountIn: BigNumber(baseAmountIn).minus(fee),
                inputReserve: virtualBase.minus(realBase),
                outputReserve: virtualQuote.plus(realQuote),
            }).toNumber()
        }

        return Math.floor(amountOut * (1 - slippage / 100))
    }

    getSwapInstruction(
        amountIn: number,
        minAmountOut: number,
        swapAccountkey: RaydiumLaunchPadAccountKeys
    ): TransactionInstruction {

        const { inputMint, payer } = swapAccountkey
        const [authority] = PublicKey.findProgramAddressSync([LAUNCHPAD_AUTH_SEED], RAYDIUM_LAUNCHLAB_MAINNET_ADDR)
        const [eventAuth] = PublicKey.findProgramAddressSync([LAUNCHPAD_POOL_EVENT_AUTH_SEED], RAYDIUM_LAUNCHLAB_MAINNET_ADDR)

        const baseUserAta = getAssociatedTokenAddressSync(this.poolInfo.baseMint, payer)
        const quoteUserAta = getAssociatedTokenAddressSync(this.poolInfo.quoteMint, payer)

        if (inputMint.toBase58() == NATIVE_MINT.toBase58()) {
            return buyExactInIx(
                RAYDIUM_LAUNCHLAB_MAINNET_ADDR,
                payer,
                authority,
                this.poolInfo.globalConfig,
                this.poolInfo.platformConfig,
                this.poolId,
                baseUserAta,
                quoteUserAta,
                this.poolInfo.baseVault,
                this.poolInfo.quoteVault,
                this.poolInfo.baseMint,
                this.poolInfo.quoteMint,
                TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                eventAuth,
                amountIn,
                minAmountOut,
                0
            )
        } else {
            return sellExactInIx(
                RAYDIUM_LAUNCHLAB_MAINNET_ADDR,
                payer,
                authority,
                this.poolInfo.globalConfig,
                this.poolInfo.platformConfig,
                this.poolId,
                baseUserAta,
                quoteUserAta,
                this.poolInfo.baseVault,
                this.poolInfo.quoteVault,
                this.poolInfo.baseMint,
                this.poolInfo.quoteMint,
                TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                eventAuth,
                amountIn,
                minAmountOut,
                0
            )
        }

    }
}