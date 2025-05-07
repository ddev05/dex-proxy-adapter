import { Connection, PublicKey, Keypair, TransactionInstruction } from "@solana/web3.js";
import { PoolReserves } from "../types";
import { IDexReadAdapter } from "../utils/iAdapter";
import { AmmInfo, parseAmmInfo, RAYDIUM_V4_DEVNET_PROGRAM, RAYDIUM_V4_MAINNET_PROGRAM, RaydiumV4SwapAccount } from "./src";
import { AccountLayout, Account, MintLayout, NATIVE_MINT, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { AnchorProvider, BN, Program } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import idl from "../idl/proxy_contract.json"
import type { ProxyContract } from "../idl/proxy_contract"

export class RaydiumV4Adapter implements IDexReadAdapter {
    private connection: Connection;
    private program: Program<ProxyContract>;
    private cluster: "mainnet" | "devnet";
    private poolInfo: AmmInfo | null;

    private constructor(
        connection: Connection,
        program: Program<ProxyContract>,
        cluster: "mainnet" | "devnet",
        poolInfo: AmmInfo | null
    ) {
        this.connection = connection;
        this.program = program;
        this.cluster = cluster;
        this.poolInfo = poolInfo;
    }

    static async create(connection: Connection, poolAddress: string, cluster: "mainnet" | "devnet" = "mainnet") {
        const wallet = new NodeWallet(Keypair.generate());
        const provider = new AnchorProvider(connection, wallet);
        const program = new Program<ProxyContract>(idl as ProxyContract, provider);
        const poolId = new PublicKey(poolAddress);

        let poolInfo: AmmInfo | null = null;
        const data = await connection.getAccountInfo(poolId);
        if (data) {
            poolInfo = parseAmmInfo(data.data);
        }

        return new RaydiumV4Adapter(connection, program, cluster, poolInfo);
    }

    async getPoolKeys(): Promise<AmmInfo | null> {
        return this.poolInfo;
    }

    async getPoolReserves(
    ): Promise<PoolReserves> {
        try {
            if (!this.poolInfo || !this.poolInfo?.baseVault || !this.poolInfo?.quoteVault) return {
                //  @ts-ignore
                token0: this.poolInfo.baseMint.toBase58(),
                //  @ts-ignore
                token1: this.poolInfo.quoteMint.toBase58(),
                reserveToken0: 0,
                reserveToken1: 0,
            }

            const [baseVaultData, quoteVaultData] = await this.connection.getMultipleAccountsInfo([
                this.poolInfo.baseVault,
                this.poolInfo.quoteVault,
            ]);

            if (!baseVaultData || !quoteVaultData) {
                return {
                    token0: this.poolInfo.baseMint.toBase58(),
                    token1: this.poolInfo.quoteMint.toBase58(),
                    reserveToken0: 0,
                    reserveToken1: 0
                };
            }

            const baseVaultDecoded = AccountLayout.decode(baseVaultData.data);
            const quoteVaultDecoded = AccountLayout.decode(quoteVaultData.data);



            return {
                token0: this.poolInfo.baseMint.toBase58(),
                token1: this.poolInfo.quoteMint.toBase58(),
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
            this.poolInfo.baseMint,
            this.poolInfo.quoteMint
        ]);

        if (!baseMintInfo || !quoteMintInfo) return 0;

        const baseMintParsedInfo = MintLayout.decode(baseMintInfo.data);
        const quoteMintParsedInfo = MintLayout.decode(quoteMintInfo.data);

        const reserveUIBase = reserveBase / 10 ** baseMintParsedInfo.decimals;
        const reserveUIQuote = reserveQuote / 10 ** quoteMintParsedInfo.decimals;

        if (this.poolInfo.quoteMint.toBase58() == NATIVE_MINT.toBase58()) {
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

    async getSwapInstruction(
        amountIn: number,
        minAmountOut: number,
        swapAccountkey: RaydiumV4SwapAccount
    ): Promise<TransactionInstruction> {
        const {
            amm,
            ammCoinVault,
            ammPcVault,
            inputMint,
            userSourceOwner,
        } = swapAccountkey;

        if (!this.poolInfo) {
            throw new Error("Pool info not loaded.");
        }

        const ix = await this.program.methods
            .raydiumV4SwapBaseIn(new BN(amountIn), new BN(minAmountOut))
            .accounts({
                amm,
                ammCoinVault,
                ammPcVault,
                ammProgram: this.cluster === "mainnet"
                    ? RAYDIUM_V4_MAINNET_PROGRAM
                    : RAYDIUM_V4_DEVNET_PROGRAM,
                userTokenDestinationMint: inputMint.equals(this.poolInfo.baseMint)
                    ? this.poolInfo.quoteMint
                    : this.poolInfo.baseMint,
                userTokenSourceMint: inputMint,
                userSourceOwner,
            })
            .instruction();

        return ix;
    }
}