// import { Connection, PublicKey, Keypair, TransactionInstruction } from "@solana/web3.js";
// import { PoolReserves } from "../types";
// import { IDexReadAdapter } from "../utils/iAdapter";
// import { AccountLayout, Account, MintLayout, NATIVE_MINT, getAssociatedTokenAddressSync } from "@solana/spl-token";
// import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
// import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
// import { parsePool, PumpSwapAccount, PumpSwapPoolInfo } from "./src";

// export class PumpSwapAdapter implements IDexReadAdapter {
//     private connection: Connection;
//     private cluster: "mainnet" | "devnet";

//     public lpFeeBasisPoints: number = 20;
//     public protocolFeeBasisPoints: number = 5;
//     private poolInfo: PumpSwapPoolInfo | null

//     private constructor(
//         connection: Connection,
//         cluster: "mainnet" | "devnet",
//         poolInfo: PumpSwapPoolInfo | null
//     ) {
//         this.connection = connection;
//         this.cluster = cluster;
//         this.poolInfo = poolInfo;
//     }

//     static async create(connection: Connection, poolAddress: string, cluster: "mainnet" | "devnet" = "mainnet") {
//         const wallet = new NodeWallet(Keypair.generate());
//         const provider = new AnchorProvider(connection, wallet);
//         const poolId = new PublicKey(poolAddress);

//         let poolInfo: PumpSwapPoolInfo | null = null;
//         const data = await connection.getAccountInfo(poolId);
//         if (data) {
//             poolInfo = parsePool(data.data);
//         }

//         return new PumpSwapAdapter(connection, program, cluster, poolInfo);
//     }

//     async getPoolKeys(): Promise<PumpSwapPoolInfo | null> {
//         return this.poolInfo;
//     }

//     async getPoolReserves(
//     ): Promise<PoolReserves> {
//         try {
//             if (!this.poolInfo || !this.poolInfo?.pool_base_token_account || !this.poolInfo?.pool_quote_token_account) return {
//                 //  @ts-ignore
//                 token0: this.poolInfo.baseMint.toBase58(),
//                 //  @ts-ignore
//                 token1: this.poolInfo.quoteMint.toBase58(),
//                 reserveToken0: 0,
//                 reserveToken1: 0,
//             }

//             const [baseVaultData, quoteVaultData] = await this.connection.getMultipleAccountsInfo([
//                 this.poolInfo.pool_base_token_account,
//                 this.poolInfo.pool_quote_token_account,
//             ]);

//             if (!baseVaultData || !quoteVaultData) {
//                 return {
//                     token0: this.poolInfo.pool_base_token_account.toBase58(),
//                     token1: this.poolInfo.pool_quote_token_account.toBase58(),
//                     reserveToken0: 0,
//                     reserveToken1: 0
//                 };
//             }

//             const baseVaultDecoded = AccountLayout.decode(baseVaultData.data);
//             const quoteVaultDecoded = AccountLayout.decode(quoteVaultData.data);

//             return {
//                 token0: this.poolInfo.base_mint.toBase58(),
//                 token1: this.poolInfo.quote_mint.toBase58(),
//                 reserveToken0: Number(baseVaultDecoded.amount),
//                 reserveToken1: Number(quoteVaultDecoded.amount),
//             };
//         } catch (err) {
//             console.error("Failed to fetch pool reserves:", err);
//             return {
//                 token0: "",
//                 token1: "",
//                 reserveToken0: 0,
//                 reserveToken1: 0
//             };
//         }
//     }

//     async getPrice(reserve: PoolReserves): Promise<number> {
//         const { reserveToken0: reserveBase, reserveToken1: reserveQuote } = reserve;

//         if (!this.poolInfo) return 0;

//         const [baseMintInfo, quoteMintInfo] = await this.connection.getMultipleAccountsInfo([
//             this.poolInfo.base_mint,
//             this.poolInfo.quote_mint
//         ]);

//         if (!baseMintInfo || !quoteMintInfo) return 0;

//         const baseMintParsedInfo = MintLayout.decode(baseMintInfo.data);
//         const quoteMintParsedInfo = MintLayout.decode(quoteMintInfo.data);

//         const reserveUIBase = reserveBase / 10 ** baseMintParsedInfo.decimals;
//         const reserveUIQuote = reserveQuote / 10 ** quoteMintParsedInfo.decimals;

//         if (this.poolInfo.quote_mint.toBase58() == NATIVE_MINT.toBase58()) {
//             return reserveUIQuote / reserveUIBase;
//         } else {
//             return reserveUIBase / reserveUIQuote;
//         }
//     }

//     getSwapQuote(baseAmountIn: number, inputMint: string, reserve: PoolReserves, slippage: number = 0): number {
//         let reserveIn: number, reserveOut: number
//         if (inputMint == reserve.token0) { reserveIn = reserve.reserveToken0, reserveOut = reserve.reserveToken1 }
//         else { reserveOut = reserve.reserveToken0, reserveIn = reserve.reserveToken1 }
//         const feeRaw = baseAmountIn * 25 / 10000;
//         const amountInWithFee = baseAmountIn - feeRaw;

//         const denominator = reserveIn + amountInWithFee;

//         const amountOutRaw =
//             Math.floor((Number(reserveOut) / Number(denominator)) * Number(amountInWithFee));

//         const amountOutRawWithSlippage = Math.floor(amountOutRaw * (1 - slippage / 100))
//         return amountOutRawWithSlippage;
//     }

//     async getSwapInstruction(
//         amountIn: number,
//         minAmountOut: number,
//         swapAccountkey: PumpSwapAccount
//     ): Promise<TransactionInstruction> {
//         const {
//             inputMint,
//             pool,
//             baseMint,
//             quoteMint,
//             baseTokenProgram,
//             quoteTokenProgram,
//             user,
//         } = swapAccountkey;

//         if (!this.poolInfo) {
//             throw new Error("Pool info not loaded.");
//         }

        

//         return ix;
//     }
// }