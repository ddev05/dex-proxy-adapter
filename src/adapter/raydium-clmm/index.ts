import { Connection, PublicKey, Keypair, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { PoolReserves } from "../types";
import { IDexReadAdapter } from "../utils/iAdapter";
import { MintLayout, NATIVE_MINT } from "@solana/spl-token";
import { EXTENSION_TICKARRAY_BITMAP_SIZE, parsePoolInfo, PoolInfo, TickArrayBitmapExtensionType } from "./src";
import { BN } from "bn.js";

export class RaydiumClmmAdapter implements IDexReadAdapter {
    private connection: Connection;
    private cluster: "mainnet" | "devnet";
    private poolInfo: PoolInfo | null;

    public exTickArrayBitmap: TickArrayBitmapExtensionType;

    private constructor(
        connection: Connection,
        poolId: PublicKey,
        cluster: "mainnet" | "devnet",
        poolInfo: PoolInfo | null
    ) {
        this.connection = connection;
        this.cluster = cluster;
        this.poolInfo = poolInfo;

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

        let poolInfo: PoolInfo | null = null;
        const data = await connection.getAccountInfo(poolId);
        if (data) {
            poolInfo = parsePoolInfo(data.data);
        }

        return new RaydiumClmmAdapter(connection, poolId, cluster, poolInfo);
    }

    getPoolKeys(): PoolInfo | null {
        return this.poolInfo;
    }

    async getPoolReserves(
    ): Promise<PoolReserves> {

        return {
            token0: "",
            token1: "",
            reserveToken0: 0,
            reserveToken1: 0
        };
    }

    async getPrice(reserve: PoolReserves): Promise<number> {
        const { reserveToken0: reserveBase, reserveToken1: reserveQuote } = reserve;

        if (!this.poolInfo) return 0;

        const [baseMintInfo, quoteMintInfo] = await this.connection.getMultipleAccountsInfo([
            this.poolInfo.mintA,
            this.poolInfo.mintB
        ]);

        if (!baseMintInfo || !quoteMintInfo) return 0;

        const baseMintParsedInfo = MintLayout.decode(baseMintInfo.data);
        const quoteMintParsedInfo = MintLayout.decode(quoteMintInfo.data);

        const reserveUIBase = reserveBase / 10 ** baseMintParsedInfo.decimals;
        const reserveUIQuote = reserveQuote / 10 ** quoteMintParsedInfo.decimals;

        if (this.poolInfo.mintB.toBase58() == NATIVE_MINT.toBase58()) {
            return reserveUIQuote / reserveUIBase;
        } else {
            return reserveUIBase / reserveUIQuote;
        }
    }

    getSwapQuote(baseAmountIn: number, inputMint: string, reserve: PoolReserves, slippage: number = 0): number {
        let reserveIn: number, reserveOut: number
        if (inputMint == reserve.token0) { reserveIn = reserve.reserveToken0, reserveOut = reserve.reserveToken1 }
        else { reserveOut = reserve.reserveToken0, reserveIn = reserve.reserveToken1 }
        const feeRaw = baseAmountIn * 25 / 10000;
        const amountInWithFee = baseAmountIn - feeRaw;

        const denominator = reserveIn + amountInWithFee;

        const amountOutRaw =
            Math.floor((Number(reserveOut) / Number(denominator)) * Number(amountInWithFee));

        const amountOutRawWithSlippage = Math.floor(amountOutRaw * (1 - slippage / 100))
        return amountOutRawWithSlippage;
    }

    getSwapInstruction(amountIn: number, minAmountOut: number, swapAccountkey: any): TransactionInstruction {
        const ix: TransactionInstruction = new TransactionInstruction({
            keys: [
                {
                    isSigner: false,
                    isWritable: false,
                    pubkey: SystemProgram.programId
                }
            ],
            programId: SystemProgram.programId,
        });

        return ix
    }

    // getSwapInstruction(
    //     amountIn: number,
    //     minAmountOut: number,
    //     swapAccountkey: RaydiumV4SwapAccount
    // ): TransactionInstruction {

    // }
}