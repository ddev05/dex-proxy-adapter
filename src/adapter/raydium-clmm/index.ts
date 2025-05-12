import { Connection, PublicKey, Keypair, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { PoolReserves } from "../types";
import { IDexReadAdapter } from "../utils/iAdapter";
import { AccountLayout, getAssociatedTokenAddressSync, MintLayout, NATIVE_MINT, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AmmConfig, createAmmV3SwapV2Instruction, EXTENSION_TICKARRAY_BITMAP_SIZE, MEMO_PROGRAM_ID, parseAmmConfig, parsePoolInfo, parseTickArrayBitmapExtension, parseTickArrayState, PoolInfo, RAYDIUM_CLMM_DEVNET_ADDR, RAYDIUM_CLMM_MAINNET_ADDR, RaydiumClmmAccountKeys, TickArray, TickArrayBitmapExtension, TickArrayBitmapExtensionType } from "./src";
import BN from "bn.js";
import { getInitializedTickArrayInRange, getPdaExBitmapAccount, getPdaTickArrayAddress, getTickArrayStartIndexByTick, sqrtPriceX64ToPrice } from "./src/utils";
import { computeAmountOut } from "./src/utils/poolUtils";

export class RaydiumClmmAdapter implements IDexReadAdapter {
    private connection: Connection;
    private cluster: "mainnet" | "devnet";
    private poolId: PublicKey;
    private exBitmapAddress: PublicKey;
    public poolInfo: PoolInfo;
    private tickArrays: PublicKey[];
    private tickArrayCache: {
        [key: string]: TickArray;
    };
    private exBitmapInfoData: TickArrayBitmapExtension;
    public exTickArrayBitmap: TickArrayBitmapExtensionType;
    private ammConfig: AmmConfig;

    private constructor(
        connection: Connection,
        poolId: PublicKey,
        exBitmapAddress: PublicKey,
        poolInfo: PoolInfo,
        tickArrays: PublicKey[],
        exBitmapInfoData: TickArrayBitmapExtension,
        tickArrayCache: {
            [key: string]: TickArray;
        },
        ammConfig: AmmConfig,
        cluster: "mainnet" | "devnet",
    ) {
        this.connection = connection;
        this.cluster = cluster;
        this.poolInfo = poolInfo;
        this.poolId = poolId;
        this.exBitmapAddress = exBitmapAddress;
        this.tickArrays = tickArrays;
        this.tickArrayCache = tickArrayCache;
        this.exBitmapInfoData = exBitmapInfoData;
        this.ammConfig = ammConfig;

        this.exTickArrayBitmap = {
            poolId: poolId,
            positiveTickArrayBitmap: Array.from({ length: EXTENSION_TICKARRAY_BITMAP_SIZE }, () =>
                Array.from({ length: 8 }, () => new BN(0)),
            ),
            negativeTickArrayBitmap: Array.from({ length: EXTENSION_TICKARRAY_BITMAP_SIZE }, () =>
                Array.from({ length: 8 }, () => new BN(0)),
            ),
        }
    }

    static async create(connection: Connection, poolAddress: string, cluster: "mainnet" | "devnet" = "mainnet") {
        const poolId = new PublicKey(poolAddress);

        const raydiumProgramId = cluster == "mainnet" ? RAYDIUM_CLMM_MAINNET_ADDR : RAYDIUM_CLMM_DEVNET_ADDR

        // Get the exBitmap address
        const [exBitmapAddress] = getPdaExBitmapAccount(
            raydiumProgramId,
            new PublicKey(poolId),
        );

        const [data, exBitmapInfo] = await connection.getMultipleAccountsInfo([poolId, exBitmapAddress])

        if (!data || !exBitmapInfo) {
            throw new Error("Eror in creating Adapter");
        }

        const poolInfo = parsePoolInfo(data.data);
        const exBitmapInfoData = parseTickArrayBitmapExtension(exBitmapInfo.data)



        const currentTickArrayStartIndex = getTickArrayStartIndexByTick(poolInfo?.tickCurrent, poolInfo?.tickSpacing)

        const startIndexArray = getInitializedTickArrayInRange(
            poolInfo.tickArrayBitmap.map(ele => new BN(ele.toString())),
            exBitmapInfoData,
            poolInfo.tickSpacing,
            currentTickArrayStartIndex,
            7
        )

        const tickArrays = startIndexArray.map(itemIndex => {
            const [tickArrayAddress] = getPdaTickArrayAddress(
                raydiumProgramId,
                new PublicKey(poolId),
                itemIndex,
            );
            return tickArrayAddress;
        });

        const newData = await connection.getMultipleAccountsInfo([poolInfo.ammConfig, ...tickArrays])

        const ammConfigRawData = newData[0]
        const tickArraysData = newData.slice(1)

        if (!ammConfigRawData?.data) {
            throw new Error("Error in creating Adapter")
        }

        const ammConfig = parseAmmConfig(ammConfigRawData?.data)

        const tickArrayCache: { [key: string]: TickArray } = tickArraysData.reduce((acc, ele, idx) => {
            if (!ele) return acc;

            const parsed = parseTickArrayState(ele.data);
            acc[parsed.startTickIndex] = parsed;

            return acc;
        }, {} as { [key: string]: TickArray });

        return new RaydiumClmmAdapter(connection, poolId, exBitmapAddress, poolInfo, tickArrays, exBitmapInfoData, tickArrayCache, ammConfig, cluster);
    }

    getPoolKeys(): PoolInfo | null {
        return this.poolInfo;
    }

    async getPoolReserves(
    ): Promise<PoolReserves> {
        const data = await this.connection.getAccountInfo(this.poolId);
        if (data) {
            this.poolInfo = parsePoolInfo(data.data);
            const [vaultAData, vaultBData] = await this.connection.getMultipleAccountsInfo([this.poolInfo.vaultA, this.poolInfo.vaultB])

            if (!vaultAData || !vaultBData) {
                return {
                    token0: "",
                    token1: "",
                    reserveToken0: 0,
                    reserveToken1: 0
                };
            }

            const reserveA = AccountLayout.decode(vaultAData.data).amount
            const reserveB = AccountLayout.decode(vaultBData.data).amount

            return {
                token0: this.poolInfo.mintA.toBase58(),
                token1: this.poolInfo.mintB.toBase58(),
                reserveToken0: Number(reserveA),
                reserveToken1: Number(reserveB)
            };
        } else {
            return {
                token0: "",
                token1: "",
                reserveToken0: 0,
                reserveToken1: 0
            };
        }
    }

    async getPrice(): Promise<number> {
        if (this.poolInfo?.sqrtPriceX64) {
            const price = sqrtPriceX64ToPrice(new BN(this.poolInfo?.sqrtPriceX64.toString()), this.poolInfo?.mintDecimalsA, this.poolInfo?.mintDecimalsB)
            return Number(price.toString())
        } else {
            return 0
        }
    }

    getSwapQuote(baseAmountIn: number, inputMint: string, reserve: PoolReserves | null, slippage: number = 0): { amountOut: number, remainingAccount: PublicKey[], xPrice: BN } {
        const returnData = computeAmountOut({
            amountIn: new BN(baseAmountIn),
            baseMint: new PublicKey(inputMint),
            poolInfo: this.poolInfo,
            poolId: this.poolId,
            slippage,
            tickArrayCache: this.tickArrayCache,
            tickArrayBitmap: this.poolInfo.tickArrayBitmap.map(ele => new BN(ele.toString())),
            exBitmapInfo: this.exBitmapInfoData,
            tradeFeeRate: this.ammConfig.tradeFeeRate,
            cluster: this.cluster
        })

        return { amountOut: Number(returnData.minAmountOut), remainingAccount: [this.exBitmapAddress, ...returnData.remainingAccounts], xPrice: new BN(returnData.executionPriceX64) }
    }

    getSwapInstruction(
        amountIn: number,
        minAmountOut: number,
        swapAccountkey: RaydiumClmmAccountKeys
    ): TransactionInstruction {
        const {
            inputMint,
            payer
        } = swapAccountkey

        if (!this.poolInfo) {
            throw new Error("Pool info not loaded.");
        }

        const { ammConfig, } = this.poolInfo

        const ataA = getAssociatedTokenAddressSync(this.poolInfo.mintA, payer)
        const ataB = getAssociatedTokenAddressSync(this.poolInfo.mintB, payer)

        const ix = createAmmV3SwapV2Instruction({
            ammConfig,
            poolState: this.poolId,
            inputVaultMint: inputMint.toBase58() == this.poolInfo.mintA.toBase58() ? this.poolInfo.mintA : this.poolInfo.mintB,
            outputVaultMint: inputMint.toBase58() != this.poolInfo.mintA.toBase58() ? this.poolInfo.mintA : this.poolInfo.mintB,
            inputVault: inputMint.toBase58() == this.poolInfo.mintA.toBase58() ? this.poolInfo.vaultA : this.poolInfo.vaultB,
            outputVault: inputMint.toBase58() != this.poolInfo.mintA.toBase58() ? this.poolInfo.vaultA : this.poolInfo.vaultB,
            observationState: this.poolInfo.observationId,
            inputTokenAccount: inputMint.toBase58() == this.poolInfo.mintA.toBase58() ? ataA : ataB,
            outputTokenAccount: inputMint.toBase58() != this.poolInfo.mintA.toBase58() ? ataA : ataB,
            payer,
            memoProgram: MEMO_PROGRAM_ID,
            programId: this.cluster == "mainnet" ? RAYDIUM_CLMM_MAINNET_ADDR : RAYDIUM_CLMM_DEVNET_ADDR,
            tokenProgram: TOKEN_PROGRAM_ID,
            tokenProgram2022: TOKEN_2022_PROGRAM_ID,
            amount: amountIn,
            otherAmountThreshold: minAmountOut,
            sqrtPriceLimitX64: BigInt(0),
            isBaseInput: true,
            remainingAccounts: swapAccountkey.remainingAccounts ? swapAccountkey.remainingAccounts.map(pubkey => { return { pubkey: pubkey, isSigner: false, isWritable: true } }) : [],
            cluster: this.cluster
        })

        return ix
    }
}