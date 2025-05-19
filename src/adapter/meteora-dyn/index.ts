import { Connection, PublicKey, Keypair, TransactionInstruction, SystemProgram } from "@solana/web3.js";
import { PoolReserves } from "../types";
import { IDexReadAdapter } from "../utils/iAdapter";
import { AccountLayout, Account, MintLayout, NATIVE_MINT, getAssociatedTokenAddressSync, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { calculateMaxSwapOutAmount, calculatePoolInfo, calculateProtocolTradingFee, calculateTradingFee, calculateWithdrawableAmount, computeOutAmount, getAmountByShare, getUnmintAmount, MeteoraPoolInfo, MeteoraSwapAccount, parsePoolAccount, parseVaultAccount, TradeDirection, VAULT_WITH_NON_PDA_BASED_LP_MINT, VaultAccount } from "./src";
import { LP_MINT_PREFIX, METEORA_PROGRAM_ADDR, METEORA_VAULT_PROGRAM, TOKEN_VAULT_PREFIX, createMeteoraSwapInstruction } from "./src";
import BigNumber from "bignumber.js";

export class MeteoraDynAdapter implements IDexReadAdapter {
    private connection: Connection;
    private cluster: "mainnet" | "devnet";

    private poolInfo: MeteoraPoolInfo | null
    private pool: PublicKey;

    private poolVaultAState: VaultAccount | null;
    private poolVaultBState: VaultAccount | null;

    private poolVaultALp!: BigNumber;
    private poolVaultBLp!: BigNumber;
    private vaultALpSupply!: BigNumber;
    private vaultBLpSupply!: BigNumber;
    private poolLpSupply!: BigNumber;
    private aVaultParsedData!: BigNumber;
    private bVaultParsedData!: BigNumber;

    private constructor(
        connection: Connection,
        cluster: "mainnet" | "devnet",
        poolInfo: MeteoraPoolInfo | null,
        poolVaultAState: VaultAccount | null,
        poolVaultBState: VaultAccount | null,
        pool: PublicKey
    ) {
        this.connection = connection;
        this.cluster = cluster;
        this.pool = pool;
        this.poolInfo = poolInfo;
        this.poolVaultAState = poolVaultAState;
        this.poolVaultBState = poolVaultBState;
    }

    static async create(connection: Connection, poolAddress: string, cluster: "mainnet" | "devnet" = "mainnet") {
        const poolId = new PublicKey(poolAddress);

        let poolInfo: MeteoraPoolInfo | null = null;
        const data = await connection.getAccountInfo(poolId);
        if (data) {
            poolInfo = parsePoolAccount(data.data);
        }

        if (!poolInfo) throw new Error("Error in getting Pool Info")

        const [dataA, dataB] = await connection.getMultipleAccountsInfo([poolInfo.aVault, poolInfo.bVault])

        if (!dataA || !dataB) throw new Error("Error in getting Vault Info")

        const poolVaultAState = parseVaultAccount(dataA?.data)
        const poolVaultBState = parseVaultAccount(dataB?.data)


        return new MeteoraDynAdapter(connection, cluster, poolInfo, poolVaultAState, poolVaultBState, poolId);
    }

    getPoolKeys(): MeteoraPoolInfo | null {
        return this.poolInfo;
    }

    async getPoolReserves(
    ): Promise<PoolReserves> {
        try {
            if (!this.poolInfo || !this.poolVaultAState || !this.poolVaultBState) return {
                //  @ts-ignore
                token0: this.poolInfo.baseMint.toBase58(),
                //  @ts-ignore
                token1: this.poolInfo.quoteMint.toBase58(),
                reserveToken0: 0,
                reserveToken1: 0,
            }

            const [aVaultLpMint] = VAULT_WITH_NON_PDA_BASED_LP_MINT[this.poolInfo.aVault.toBase58()] == undefined ? PublicKey.findProgramAddressSync([Buffer.from(LP_MINT_PREFIX), this.poolInfo.aVault.toBuffer()], METEORA_VAULT_PROGRAM) : [VAULT_WITH_NON_PDA_BASED_LP_MINT[this.poolInfo.aVault.toBase58()]];
            const [bVaultLpMint] = VAULT_WITH_NON_PDA_BASED_LP_MINT[this.poolInfo.bVault.toBase58()] == undefined ? PublicKey.findProgramAddressSync([Buffer.from(LP_MINT_PREFIX), this.poolInfo.bVault.toBuffer()], METEORA_VAULT_PROGRAM) : [VAULT_WITH_NON_PDA_BASED_LP_MINT[this.poolInfo.bVault.toBase58()]];

            const [baseVaultData, quoteVaultData, aVaultLpMintData, bVaultLpMintData, lpMintData, aVaultData, bVaultData] = await this.connection.getMultipleAccountsInfo([
                this.poolInfo.aVaultLp,
                this.poolInfo.bVaultLp,
                aVaultLpMint,
                bVaultLpMint,
                this.poolInfo.lpMint,
                this.poolVaultAState.tokenVault,
                this.poolVaultBState.tokenVault
            ]);

            if (!baseVaultData || !quoteVaultData || !aVaultLpMintData || !bVaultLpMintData || !aVaultData || !bVaultData || !lpMintData || this.poolVaultAState == null || this.poolVaultBState == null) {
                return {
                    token0: this.poolInfo.aVault.toBase58(),
                    token1: this.poolInfo.bVault.toBase58(),
                    reserveToken0: 0,
                    reserveToken1: 0
                };
            }

            this.poolVaultALp = BigNumber(AccountLayout.decode(baseVaultData.data).amount);
            this.poolVaultBLp = BigNumber(AccountLayout.decode(quoteVaultData.data).amount);
            this.vaultALpSupply = BigNumber(MintLayout.decode(aVaultLpMintData.data).supply)
            this.vaultBLpSupply = BigNumber(MintLayout.decode(bVaultLpMintData.data).supply)
            this.poolLpSupply = BigNumber(MintLayout.decode(lpMintData.data).supply)
            this.aVaultParsedData = BigNumber(AccountLayout.decode(aVaultData.data).amount);
            this.bVaultParsedData = BigNumber(AccountLayout.decode(bVaultData.data).amount);

            const data = calculatePoolInfo(
                BigNumber(Math.floor(Date.now() / 1000) - 3),
                this.poolVaultALp,
                this.poolVaultBLp,
                this.vaultALpSupply,
                this.vaultBLpSupply,
                this.poolLpSupply,
                this.poolVaultAState,
                this.poolVaultBState
            )

            return {
                token0: this.poolInfo.tokenAMint.toBase58(),
                token1: this.poolInfo.tokenBMint.toBase58(),
                reserveToken0: Number(data.tokenAAmount),
                reserveToken1: Number(data.tokenBAmount),
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

        if (!this.poolInfo) return 0

        if (this.poolInfo.tokenAMint.toBase58() != NATIVE_MINT.toBase58()) {
            return reserveQuote / reserveBase;
        } else {
            return reserveBase / reserveQuote;
        }
    }

    //  @ts-ignore
    getSwapQuote(baseAmountIn: number, inputMint: string, slippage: number = 0): BigNumber {
        let reserveIn: number, reserveOut: number;

        if (!this.poolInfo || !this.poolVaultAState || !this.poolVaultBState) throw new Error("Pool Info didn't be loaded")

        const { tokenAMint, tokenBMint } = this.poolInfo;

        const currentTime = Date.now() - 3;

        const vaultAWithdrawableAmount = calculateWithdrawableAmount(currentTime, this.poolVaultAState);
        const vaultBWithdrawableAmount = calculateWithdrawableAmount(currentTime, this.poolVaultBState);

        const tokenAAmount = getAmountByShare(this.poolVaultALp, vaultAWithdrawableAmount, this.vaultALpSupply);
        const tokenBAmount = getAmountByShare(this.poolVaultBLp, vaultBWithdrawableAmount, this.vaultBLpSupply);

        const isFromAToB = new PublicKey(inputMint).equals(tokenAMint);

        const [
            sourceAmount,
            swapSourceVaultLpAmount,
            swapSourceAmount,
            swapDestinationAmount,
            swapSourceVault,
            swapDestinationVault,
            swapSourceVaultLpSupply,
            swapDestinationVaultLpSupply,
            tradeDirection,
        ] = isFromAToB
                ? [
                    BigNumber(baseAmountIn),
                    this.poolVaultALp,
                    tokenAAmount,
                    tokenBAmount,
                    this.poolVaultAState,
                    this.poolVaultBState,
                    this.vaultALpSupply,
                    this.vaultBLpSupply,
                    TradeDirection.AToB,
                ]
                : [
                    BigNumber(baseAmountIn),
                    this.poolVaultBLp,
                    tokenBAmount,
                    tokenAAmount,
                    this.poolVaultBState,
                    this.poolVaultAState,
                    this.vaultBLpSupply,
                    this.vaultALpSupply,
                    TradeDirection.BToA,
                ];

        const tradeFee = calculateTradingFee(sourceAmount, this.poolInfo);
        // Protocol fee is a cut of trade fee
        const protocolFee = calculateProtocolTradingFee(tradeFee, this.poolInfo);
        const tradeFeeAfterProtocolFee = tradeFee.minus(protocolFee);

        const sourceVaultWithdrawableAmount = calculateWithdrawableAmount(currentTime, swapSourceVault);

        const beforeSwapSourceAmount = swapSourceAmount;
        const sourceAmountLessProtocolFee = sourceAmount.minus(protocolFee);

        // Get vault lp minted when deposit to the vault
        const sourceVaultLp = getUnmintAmount(
            sourceAmountLessProtocolFee,
            sourceVaultWithdrawableAmount,
            swapSourceVaultLpSupply,
        );

        const sourceVaultTotalAmount = sourceVaultWithdrawableAmount.plus(sourceAmountLessProtocolFee);

        const afterSwapSourceAmount = getAmountByShare(
            sourceVaultLp.plus(swapSourceVaultLpAmount),
            sourceVaultTotalAmount,
            swapSourceVaultLpSupply.plus(sourceVaultLp),
        );

        const actualSourceAmount = afterSwapSourceAmount.minus(beforeSwapSourceAmount);
        let sourceAmountWithFee = actualSourceAmount.minus(tradeFeeAfterProtocolFee);

        const destinationAmount = computeOutAmount(
            sourceAmountWithFee,
            swapSourceAmount,
            swapDestinationAmount,
            tradeDirection,
        );

        const destinationVaultWithdrawableAmount = calculateWithdrawableAmount(currentTime, swapDestinationVault);
        // Get vault lp to burn when withdraw from the vault
        const destinationVaultLp = getUnmintAmount(
            destinationAmount,
            destinationVaultWithdrawableAmount,
            swapDestinationVaultLpSupply,
        );

        let actualDestinationAmount = getAmountByShare(
            destinationVaultLp,
            destinationVaultWithdrawableAmount,
            swapDestinationVaultLpSupply,
        );

        return actualDestinationAmount.times(100 - slippage).div(100)
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

        const [aVaultLpMint] = VAULT_WITH_NON_PDA_BASED_LP_MINT[aVault.toBase58()] == undefined ? PublicKey.findProgramAddressSync([Buffer.from(LP_MINT_PREFIX), aVault.toBuffer()], METEORA_VAULT_PROGRAM) : [VAULT_WITH_NON_PDA_BASED_LP_MINT[aVault.toBase58()]];
        const [bVaultLpMint] = VAULT_WITH_NON_PDA_BASED_LP_MINT[bVault.toBase58()] == undefined ? PublicKey.findProgramAddressSync([Buffer.from(LP_MINT_PREFIX), bVault.toBuffer()], METEORA_VAULT_PROGRAM) : [VAULT_WITH_NON_PDA_BASED_LP_MINT[bVault.toBase58()]];

        const outputMint = this.poolInfo.tokenAMint == inputMint ? this.poolInfo.tokenBMint : this.poolInfo.tokenAMint

        const userSourceToken = getAssociatedTokenAddressSync(inputMint, user)
        const userDestinationToken = getAssociatedTokenAddressSync(outputMint, user)

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