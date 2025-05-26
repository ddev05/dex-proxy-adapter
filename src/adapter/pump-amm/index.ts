import {
    Connection,
    PublicKey,
    TransactionInstruction,
    SystemProgram
} from "@solana/web3.js";
import { PoolReserves } from "@/adapter/types";
import { IDexReadAdapter } from "@/adapter/utils";
import {
    AccountLayout,
    MintLayout,
    NATIVE_MINT,
    getAssociatedTokenAddressSync,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID
} from "@solana/spl-token";
import {
    createPumpswapBuyIx,
    createPumpswapSellIx,
    parsePool,
    PUMPSWAP_DEVNET_FEE_ADDR,
    PUMPSWAP_EVENT_AUTH,
    PUMPSWAP_GLOBAL_CONFIG,
    PUMPSWAP_MAINNET_FEE_ADDR,
    PUMPSWAP_POOL,
    PUMPSWAP_PROGRAM_ADDR,
    PumpSwapAccount,
    PumpSwapKeys,
    PumpSwapPoolInfo
} from "./src";
import {
    BONDING_CURVE_SEED,
    parseBondingCurve,
    PumpBondingCurveInfo,
    PUMPFUN_POOL_AUTH,
    PUMPFUN_PROGRAM_ID
} from "../pump-fun/src";
import BigNumber from "bignumber.js";

export class PumpSwapAdapter implements IDexReadAdapter {
    private connection: Connection;

    public lpFeeBasisPoints: number = 20;
    public protocolFeeBasisPoints: number = 5;
    private poolInfo: PumpSwapPoolInfo | null
    private poolId: PublicKey;

    private baseMintDecimal: number;
    private quoteMintDecimal: number;
    private baseVaultReserve: BigNumber;
    private quoteVaultReserve: BigNumber;
    private baseTokenProgram: PublicKey;
    private quoteTokenProgram: PublicKey;

    /**
     * Private constructor for initializing the PumpSwapAdapter instance.
     * Use the static `create` method to instantiate this class.
     *
     * @param connection - Solana blockchain connection object.
     * @param poolInfo - Pool information data structure or null if unavailable.
     * @param poolId - Public key of the pool account.
     * @param baseMintDecimal - Decimal places for the base token mint.
     * @param quoteMintDecimal - Decimal places for the quote token mint.
     * @param baseVaultReserve - Current reserve amount in the base token vault.
     * @param quoteVaultReserve - Current reserve amount in the quote token vault.
     * @param baseTokenProgram - Public key of the base token's owning program.
     * @param quoteTokenProgram - Public key of the quote token's owning program.
     */
    private constructor(
        connection: Connection,
        poolInfo: PumpSwapPoolInfo | null,
        poolId: PublicKey,
        baseMintDecimal: number,
        quoteMintDecimal: number,
        baseVaultReserve: BigNumber,
        quoteVaultReserve: BigNumber,
        baseTokenProgram: PublicKey,
        quoteTokenProgram: PublicKey
    ) {
        this.connection = connection;
        this.poolInfo = poolInfo;
        this.poolId = poolId;
        this.baseMintDecimal = baseMintDecimal;
        this.quoteMintDecimal = quoteMintDecimal;
        this.baseVaultReserve = baseVaultReserve;
        this.quoteVaultReserve = quoteVaultReserve;
        this.baseTokenProgram = baseTokenProgram;
        this.quoteTokenProgram = quoteTokenProgram;
    }

    /**
     * Creates and initializes a PumpSwapAdapter instance for a given mint address and index.
     *
     * @param connection - The Solana connection object to interact with the blockchain.
     * @param mintAddr - The string representation of the base token mint address.
     * @param index - Optional index used in pool PDA derivation (default: 0).
     * @returns A Promise that resolves to a PumpSwapAdapter instance initialized with pool and mint data.
     * @throws Throws an error if pool or related account data cannot be fetched or parsed.
     */
    static async create(connection: Connection, mintAddr: string, index: number = 0) {
        const baseMint = mintAddr, quoteMint = NATIVE_MINT;
        const [creator] = PublicKey.findProgramAddressSync([Buffer.from(PUMPFUN_POOL_AUTH), new PublicKey(mintAddr).toBuffer()], PUMPFUN_PROGRAM_ID)

        const buffer = Buffer.alloc(2); // 2 bytes for u16
        buffer.writeUInt16LE(index);

        const [poolId] = PublicKey.findProgramAddressSync([
            Buffer.from(PUMPSWAP_POOL),                    // const seed
            buffer,     // index seed
            creator.toBuffer(),                    // creator pubkey
            new PublicKey(baseMint).toBuffer(),                   // base mint pubkey
            quoteMint.toBuffer()                   // quote mint pubkey
        ], PUMPSWAP_PROGRAM_ADDR)

        let poolInfo: PumpSwapPoolInfo | null = null;
        const data = await connection.getAccountInfo(poolId);
        if (!data) throw new Error("Pool Info is not loaded")

        poolInfo = parsePool(data.data);

        const [
            baseMintInfo,
            quoteMintInfo,
            baseVaultData,
            quoteVaultData
        ] = await connection.getMultipleAccountsInfo([
            poolInfo?.base_mint,
            poolInfo?.quote_mint,
            poolInfo?.pool_base_token_account,
            poolInfo?.pool_quote_token_account
        ])

        if (
            !baseVaultData ||
            !quoteVaultData ||
            !baseMintInfo ||
            !quoteMintInfo
        ) throw new Error("Invalid Pool Data")

        const baseVaultDecoded = AccountLayout.decode(baseVaultData.data);
        const quoteVaultDecoded = AccountLayout.decode(quoteVaultData.data);

        const baseMintParsedInfo = MintLayout.decode(baseMintInfo.data);
        const quoteMintParsedInfo = MintLayout.decode(quoteMintInfo.data);

        console.log(baseMintInfo.owner, quoteMintInfo.owner);


        return new PumpSwapAdapter(
            connection,
            poolInfo,
            poolId,
            baseMintParsedInfo.decimals,
            quoteMintParsedInfo.decimals,
            BigNumber(baseVaultDecoded.amount),
            BigNumber(quoteVaultDecoded.amount),
            baseMintInfo.owner,
            quoteMintInfo.owner
        );
    }

    /**
     * Fetches pool keys for a given mint address from a custom address or PDA (Program Derived Address).
     *
     * @param connection - The Solana connection object to query the blockchain.
     * @param mintAddr - The public key of the token mint associated with the pool.
     * @param payer - The public key of the transaction payer (often used for seed derivation).
     * @param index - Optional index used as part of PDA derivation (default: 0).
     * @returns A Promise that resolves to the PumpSwapKeys containing all relevant pool keys.
     */
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

    /**
     * Returns the cached pool keys (swap account info), if available.
     *
     * @returns The current PumpSwapPoolInfo or null if not set.
     */
    getPoolKeys(): PumpSwapPoolInfo | null {
        return this.poolInfo;
    }

    /**
     * Fetches and returns the current token reserves for the swap pool.
     * This typically includes the amount of base and quote tokens in the pool.
     *
     * @returns A Promise resolving to the current pool reserves.
     */
    async getPoolReserves(): Promise<PoolReserves> {
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

            this.baseVaultReserve = BigNumber(baseVaultDecoded.amount);
            this.quoteVaultReserve = BigNumber(quoteVaultDecoded.amount);

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

    /**
     * Retrieves the current token price from the swap pool or external source.
     *
     * @returns The current price as a floating-point number (e.g., quote per base token).
     */
    getPrice(): number {

        if (!this.poolInfo) throw new Error("Pool Info is not loaded")

        const reserveUIBase = this.baseVaultReserve.div(10 ** this.baseMintDecimal);
        const reserveUIQuote = this.quoteVaultReserve.div(10 ** this.quoteMintDecimal);

        if (this.poolInfo.quote_mint.toBase58() == NATIVE_MINT.toBase58()) {
            return reserveUIQuote.div(reserveUIBase).toNumber();
        } else {
            return reserveUIBase.div(reserveUIQuote).toNumber();
        }
    }

    /**
     * Calculates the expected output amount for a token swap, given an input amount,
     * the mint address of the input token, and an optional slippage tolerance.
     *
     * @param baseAmountIn - The amount of input tokens to be swapped.
     * @param inputMint - The mint address of the input token.
     * @param slippage - The allowed slippage as a percentage (e.g., 0.01 for 1%). Defaults to 0.
     * @returns The estimated output amount after applying slippage.
     */
    getSwapQuote(baseAmountIn: number, inputMint: string, slippage: number = 0): number {
        let reserveIn: BigNumber, reserveOut: BigNumber;
        const baseAmount = new BigNumber(baseAmountIn);

        if (inputMint === this.poolInfo?.base_mint.toBase58()) {
            reserveIn = this.baseVaultReserve;
            reserveOut = this.quoteVaultReserve;

            const amountOut = reserveOut
                .div(reserveIn.plus(baseAmount))
                .multipliedBy(baseAmount)
                .integerValue(BigNumber.ROUND_FLOOR)
                .minus(1);

            const amountOutWithFee = amountOut
                .integerValue(BigNumber.ROUND_FLOOR);

            // Apply slippage tolerance
            const slippageMultiplier = new BigNumber(1).minus(slippage);
            const amountOutWithFeeSlippage = amountOutWithFee
                .multipliedBy(slippageMultiplier)
                .integerValue(BigNumber.ROUND_FLOOR);

            return amountOutWithFeeSlippage.toNumber();
        } else {
            reserveOut = this.baseVaultReserve;
            reserveIn = this.quoteVaultReserve;

            const solReserve = reserveIn;
            const tokenReserve = reserveOut;

            const product = solReserve.multipliedBy(tokenReserve);

            // adjustedIn = (baseAmountIn - 1) * 10000 / 10025
            const adjustedIn = baseAmount

            const newSolReserve = solReserve.plus(adjustedIn);
            const newTokenReserve = product
                .div(newSolReserve)
                .plus(1)
                .integerValue(BigNumber.ROUND_CEIL);

            const amountToBePurchased = tokenReserve
                .minus(newTokenReserve)
                .multipliedBy(new BigNumber(1).minus(slippage))
                .integerValue(BigNumber.ROUND_FLOOR);

            return amountToBePurchased.toNumber();
        }
    }

    /**
     * Constructs a swap instruction for the given swap account.
     *
     * @param amountIn - The amount of input tokens to swap.
     * @param amountOut - The minimum amount of output tokens expected.
     * @param swapAccountkey - The swap account containing relevant configuration and keys.
     * @returns A Solana TransactionInstruction object representing the swap operation.
     */
    getSwapInstruction(
        amountIn: number,
        amountOut: number,
        swapAccountkey: PumpSwapAccount
    ): TransactionInstruction {
        const {
            inputMint,
            user
        } = swapAccountkey

        if (!this.poolInfo) throw new Error("Pool Info is not loaded")

        const {
            base_mint: baseMint,
            quote_mint: quoteMint,
        } = this.poolInfo

        const {
            poolId: pool,
            baseTokenProgram,
            quoteTokenProgram
        } = this

        const coinCreator = this.poolInfo?.coin_creator
        const [coinCreatorVaultAuthority] = PublicKey.findProgramAddressSync([Buffer.from("creator_vault"), coinCreator.toBuffer()], PUMPSWAP_PROGRAM_ADDR)
        const coinCreatorVaultAta = getAssociatedTokenAddressSync(NATIVE_MINT, coinCreatorVaultAuthority, true)

        const [globalConfig] = PublicKey.findProgramAddressSync([Buffer.from(PUMPSWAP_GLOBAL_CONFIG)], PUMPSWAP_PROGRAM_ADDR)
        const [eventAuthority] = PublicKey.findProgramAddressSync([Buffer.from(PUMPSWAP_EVENT_AUTH)], PUMPSWAP_PROGRAM_ADDR)

        const protocolFeeRecipient = PUMPSWAP_MAINNET_FEE_ADDR[0]
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
                coinCreatorVaultAta,
                coinCreatorVaultAuthority
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
                coinCreatorVaultAta,
                coinCreatorVaultAuthority
            })
        }

        return ix;
    }
}