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

import { IDexReadAdapter } from "../utils/iAdapter";
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
  PumpfunSwapAccountKeys
} from "./src";
import { PoolReserves } from "../types";
import { PUMPFUN_FEE_RECIPIENT, PUMPFUN_MAINNET_EVENT_AUTH, PUMPFUN_PROGRAM_ID } from "./src/addresses";


export class PumpfunAdapter implements IDexReadAdapter {
  private connection: Connection;
  private poolInfo: PumpBondingCurveInfo | null;
  private bondingCurveAddr: PublicKey;
  private mintAddr: PublicKey;

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

  static async create(
    connection: Connection,
    tokenMint: String,
    cluster: "mainnet" | "devnet" = "mainnet"
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

  async getPoolReserves(): Promise<PoolReserves> {
    const data = await this.connection.getAccountInfo(this.bondingCurveAddr);

    if (!data?.data) {
      return {
        token0: NATIVE_MINT.toBase58(),
        token1: this.mintAddr.toBase58(),
        reserveToken0: BigNumber(0),
        reserveToken1: BigNumber(0),
      };
    }

    this.poolInfo = parseBondingCurve(data.data);

    return {
      token0: NATIVE_MINT.toBase58(),
      token1: this.mintAddr.toBase58(),
      reserveToken0: this.poolInfo.real_sol_reserves,
      reserveToken1: this.poolInfo.real_token_reserves,
    };
  }

  getPrice(): number {
    if (!this.poolInfo) return 0;

    const reserveBase = this.poolInfo.real_token_reserves
    const reserveQuote = this.poolInfo.real_sol_reserves

    return reserveQuote.div(reserveBase).toNumber();
  }

  getSwapQuote(baseAmountIn: number, inputMint: string, slippage: number = 0): number {
    if (baseAmountIn === 0) throw new Error("Trying to proceed with zero amount");
    if (!this.poolInfo) throw new Error("Pool info is not loaded");

    const realTokenReserves = this.poolInfo.real_token_reserves; // BigNumber
    const realSolReserves = this.poolInfo.real_sol_reserves;     // BigNumber

    const virtualTokenReserves = PUMPFUN_LIQ_TOKEN_DIFFERENCE.plus(realTokenReserves);
    const virtualSolReserves = PUMPFUN_LIQ_SOL_DIFFERENCE.plus(realSolReserves);

    const baseAmount = new BigNumber(baseAmountIn);
    const slippageBN = new BigNumber(slippage);
    const hundred = new BigNumber(100);

    if (inputMint === NATIVE_MINT.toBase58()) {
      // Calculate product of virtual reserves
      const n = virtualSolReserves.times(virtualTokenReserves);

      // New virtual sol reserves after purchase
      const i = virtualSolReserves.plus(baseAmount);

      // New virtual token reserves after purchase
      const r = n.div(i).plus(1);

      // Tokens to be purchased
      let s = virtualTokenReserves.minus(r);

      // Apply slippage and floor
      s = s.times(hundred.plus(slippageBN)).dividedToIntegerBy(hundred);

      // Return minimum between calculated and real reserves
      return BigNumber.minimum(s, realTokenReserves).toNumber();
    } else {
      // Calculate proportional amount of virtual sol reserves to be received
      const numerator = baseAmount.times(virtualSolReserves);
      const denominator = virtualTokenReserves.plus(baseAmount);
      const n = numerator.div(denominator).minus(1);

      // Calculate fee amount in same units
      const a = n.times(100).div(10000).plus(1);

      // Amount after fee and slippage
      let s = n.minus(a).times(hundred.minus(slippageBN)).dividedToIntegerBy(hundred);

      // Apply protocol and creator fees
      const feeRate = new BigNumber(PROTOCOL_FEE_RATE).plus(CREATOR_FEE_RATE);
      const multiplier = new BigNumber(1).plus(feeRate);

      s = s.times(multiplier).integerValue(BigNumber.ROUND_FLOOR);

      return s.toNumber();
    }
  }

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
