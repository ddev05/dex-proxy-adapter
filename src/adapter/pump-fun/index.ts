import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";

import { IDexReadAdapter } from "@/adapter/utils";
import {
  BONDING_CURVE_SEED,
  CREATOR_FEE_RATE,
  parseBondingCurve,
  PROTOCOL_FEE_RATE,
  PumpBondingCurveInfo,
  PUMPFUN_CREATOR_VAULT,
  PUMPFUN_GLOBAL,
  PUMPFUN_LIQ_SOL_DIFFERENCE,
  PUMPFUN_LIQ_TOKEN_DIFFERENCE,
  pumpfunBuyIx,
  PumpfunKeys,
  pumpfunSellIx,
  PumpfunSwapAccountKeys,
  PUMPFUN_FEE_RECIPIENT,
  PUMPFUN_MAINNET_EVENT_AUTH,
  PUMPFUN_PROGRAM_ID
} from "./src";
import { PoolReserves } from "@/adapter/types";

export class PumpfunAdapter implements IDexReadAdapter {
  private connection: Connection;
  private poolInfo: PumpBondingCurveInfo | null;
  private bondingCurveAddr: PublicKey;
  private mintAddr: PublicKey;

  /**
   * Private constructor. Use the static `create` method to instantiate this class.
   *
   * @param connection - Solana connection instance used for querying blockchain data.
   * @param poolInfo - Parsed bonding curve info, if available.
   * @param bondingCurveAddr - Public key of the bonding curve PDA.
   * @param mintAddr - Public key of the token mint associated with the bonding curve.
   */
  private constructor(
    connection: Connection,
    poolInfo: PumpBondingCurveInfo | null,
    bondingCurveAddr: PublicKey,
    mintAddr: PublicKey
  ) {
    this.connection = connection;
    this.bondingCurveAddr = bondingCurveAddr;
    this.poolInfo = poolInfo;
    this.mintAddr = mintAddr;
  }

  /**
   * Creates and initializes a PumpfunAdapter instance for a specific token mint.
   *
   * @param connection - Solana connection used to fetch bonding curve account data.
   * @param tokenMint - Token mint address as a string.
   * @returns A PumpfunAdapter instance with parsed bonding curve data, if curve is active.
   */
  static async create(
    connection: Connection,
    tokenMint: String,
  ) {
    const token_mint = new PublicKey(tokenMint);
    const [bondingCurve] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), token_mint.toBuffer()],
      PUMPFUN_PROGRAM_ID
    );

    let poolInfo: PumpBondingCurveInfo | null = null;
    const data = await connection.getAccountInfo(bondingCurve);
    if (data) {
      poolInfo = parseBondingCurve(data.data);

      if (poolInfo.complete) {
        throw new Error("Completed Bonding Curve");
      }
    }

    return new PumpfunAdapter(
      connection,
      poolInfo,
      bondingCurve,
      token_mint
    );
  }

  /**
  * Returns the parsed bonding curve data, if available.
  *
  * @returns The PumpBondingCurveInfo object or null if not available.
  */
  getPoolKeys(): PumpBondingCurveInfo | null {
    return this.poolInfo;
  }

  /**
  * Builds all required PDA and ATA addresses for a swap transaction.
  *
  * @param connection - Solana connection to fetch on-chain data.
  * @param mintAddr - Token mint address involved in the bonding curve.
  * @param payer - Public key of the user performing the swap.
  * @returns A full object of derived Pumpfun account keys required for a swap instruction.
  */
  static async getPoolsFromCa(
    connection: Connection,
    mintAddr: PublicKey,
    payer: PublicKey
  ): Promise<PumpfunKeys> {
    const [bondingCurveAddr] = PublicKey.findProgramAddressSync(
      [Buffer.from(BONDING_CURVE_SEED), mintAddr.toBuffer()],
      PUMPFUN_PROGRAM_ID
    );
    const data = await connection.getAccountInfo(bondingCurveAddr);

    if (!data) throw new Error("Completed Bonding Curve");

    const poolInfo = parseBondingCurve(data.data);
    const associatedPayerAta = getAssociatedTokenAddressSync(mintAddr, payer);
    const associatedBondingCurve = getAssociatedTokenAddressSync(
      mintAddr,
      bondingCurveAddr,
      true
    );
    const [pumpfunGlobal] = PublicKey.findProgramAddressSync(
      [Buffer.from(PUMPFUN_GLOBAL)],
      PUMPFUN_PROGRAM_ID
    );
    const [rent] = PublicKey.findProgramAddressSync(
      [
        Buffer.from(PUMPFUN_CREATOR_VAULT),
        poolInfo.creator == undefined
          ? NATIVE_MINT.toBuffer()
          : poolInfo.creator.toBuffer(),
      ],
      PUMPFUN_PROGRAM_ID
    );

    return {
      global: pumpfunGlobal,
      bondingCurve: bondingCurveAddr,
      associatedBondingCurve,
      mint: mintAddr,
      associatedUser: associatedPayerAta,
      user: payer,
      rent,
      eventAuthority: PUMPFUN_MAINNET_EVENT_AUTH,
      feeRecipient: PUMPFUN_FEE_RECIPIENT[0],
      programId: PUMPFUN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
    };
  }

  /**
  * Fetches current reserves in the bonding curve for the native SOL and token mint.
  *
  * @returns An object containing token0/token1 and their respective reserves.
  */
  async getPoolReserves(): Promise<PoolReserves> {
    const data = await this.connection.getAccountInfo(this.bondingCurveAddr);

    if (!data?.data) {
      return {
        token0: NATIVE_MINT.toBase58(),
        token1: this.mintAddr.toBase58(),
        reserveToken0: 0,
        reserveToken1: 0,
      };
    }

    this.poolInfo = parseBondingCurve(data.data);

    return {
      token0: NATIVE_MINT.toBase58(),
      token1: this.mintAddr.toBase58(),
      reserveToken0: this.poolInfo.real_sol_reserves.toNumber(),
      reserveToken1: this.poolInfo.real_token_reserves.toNumber(),
    };
  }

  /**
  * Calculates the current price of 1 token in terms of SOL from bonding curve reserves.
  *
  * @returns Price as a number (SOL per token).
  */
  getPrice(): number {
    if (!this.poolInfo) return 0;

    const reserveBase = this.poolInfo.real_token_reserves
    const reserveQuote = this.poolInfo.real_sol_reserves

    return reserveQuote.div(reserveBase).toNumber();
  }

  /**
 * Simulates a swap quote, determining how much of the output token will be received
 * for a given input amount and optional slippage.
 *
 * @param baseAmountIn - Amount of input token to swap.
 * @param inputMint - Input token mint address (as string).
 * @param slippage - Slippage tolerance in percentage (e.g., 0.01 = 1%).
 * @returns Expected output amount after slippage and fees.
 */
  getSwapQuote(baseAmountIn: number, inputMint: string, slippage: number = 0): number {
    if (baseAmountIn === 0) throw new Error("Trying to proceed with zero amount");
    if (!this.poolInfo) throw new Error("Pool info is not loaded");

    const realTokenReserves = this.poolInfo.real_token_reserves; // BigNumber
    const realSolReserves = this.poolInfo.real_sol_reserves;     // BigNumber

    const virtualTokenReserves = PUMPFUN_LIQ_TOKEN_DIFFERENCE.plus(realTokenReserves);
    const virtualSolReserves = PUMPFUN_LIQ_SOL_DIFFERENCE.plus(realSolReserves);

    const baseAmount = new BigNumber(baseAmountIn);
    const slippageBN = new BigNumber(slippage); // Decimal (e.g., 0.01 for 1%)

    if (inputMint === NATIVE_MINT.toBase58()) {
      // Buy tokens with SOL
      const n = virtualSolReserves.times(virtualTokenReserves);
      const i = virtualSolReserves.plus(baseAmount);
      const r = n.div(i).plus(1);
      let s = virtualTokenReserves.minus(r);

      // Apply slippage as decimal
      s = s.times(slippageBN.minus(1).abs()).integerValue(BigNumber.ROUND_FLOOR);

      return BigNumber.minimum(s, realTokenReserves).toNumber();
    } else {
      // Sell tokens for SOL
      const numerator = baseAmount.times(virtualSolReserves);
      const denominator = virtualTokenReserves.plus(baseAmount);
      const n = numerator.div(denominator).minus(1);

      // Apply fixed 1% fee (adjustable if needed)
      const a = n.times(PROTOCOL_FEE_RATE + CREATOR_FEE_RATE).plus(1);

      let s = n.minus(a).times(new BigNumber(1).minus(slippageBN));

      s = s.integerValue(BigNumber.ROUND_FLOOR);

      return s.toNumber();
    }
  }

  /**
   * Generates the appropriate transaction instruction to perform a buy or sell swap
   * using the Pumpfun bonding curve program.
   *
   * @param amountIn - Input amount for the swap.
   * @param amountOut - Desired or expected output amount.
   * @param swapAccountkey - Object with all required account keys to build the swap instruction.
   * @returns A `TransactionInstruction` that can be added to a transaction and sent.
   */
  getSwapInstruction(
    amountIn: number,
    amountOut: number,
    swapAccountkey: PumpfunSwapAccountKeys
  ): TransactionInstruction {
    const {
      inputMint,
      payer,
    } = swapAccountkey;

    if (!this.poolInfo) {
      throw new Error("Pool info not loaded.");
    }

    const [pumpfunGlobal] = PublicKey.findProgramAddressSync([Buffer.from(PUMPFUN_GLOBAL)], PUMPFUN_PROGRAM_ID)

    const associatedPayerAta = getAssociatedTokenAddressSync(this.mintAddr, payer);

    const associatedBondingCurve = getAssociatedTokenAddressSync(this.mintAddr, this.bondingCurveAddr, true);

    const [rent] = PublicKey.findProgramAddressSync(
      [Buffer.from(PUMPFUN_CREATOR_VAULT), this.poolInfo.creator == undefined ? NATIVE_MINT.toBuffer() : this.poolInfo.creator.toBuffer()],
      PUMPFUN_PROGRAM_ID
    );

    if (inputMint.toBase58() == NATIVE_MINT.toBase58()) {
      const tokenAmountOut = BigNumber(amountOut)
      const maxSolAmountCost = BigNumber(amountIn)
      return pumpfunBuyIx(
        PUMPFUN_PROGRAM_ID,
        pumpfunGlobal,
        PUMPFUN_FEE_RECIPIENT[0],
        this.mintAddr,
        this.bondingCurveAddr,
        associatedBondingCurve,
        associatedPayerAta,
        payer,
        TOKEN_PROGRAM_ID,
        rent,
        PUMPFUN_MAINNET_EVENT_AUTH,
        tokenAmountOut,
        maxSolAmountCost.times(1.011),
      )
    } else {
      const tokenAmountIn = BigNumber(amountIn)
      const minSolOutput = BigNumber(amountOut)
      return pumpfunSellIx(
        PUMPFUN_PROGRAM_ID,
        pumpfunGlobal,
        PUMPFUN_FEE_RECIPIENT[0],
        this.mintAddr,
        this.bondingCurveAddr,
        associatedBondingCurve,
        associatedPayerAta,
        payer,
        SystemProgram.programId,
        rent,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        TOKEN_PROGRAM_ID,
        PUMPFUN_MAINNET_EVENT_AUTH,
        tokenAmountIn,
        minSolOutput.div(1.011).integerValue()
      )
    }
  }
}
