import { PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";

export interface PumpBondingCurveInfo {
  virtual_token_reserves: BigNumber;
  virtual_sol_reserves: BigNumber;
  real_token_reserves: BigNumber;
  real_sol_reserves: BigNumber;
  token_total_supply: BigNumber;
  complete: boolean;
  creator?: PublicKey
}

export interface PumpfunSwapAccountKeys {
  inputMint: PublicKey;
  payer: PublicKey
}

export interface PumpfunKeys {
  programId: PublicKey,
  global: PublicKey,
  feeRecipient: PublicKey,
  mint: PublicKey,
  bondingCurve: PublicKey,
  associatedBondingCurve: PublicKey,
  associatedUser: PublicKey,
  user: PublicKey,
  tokenProgram: PublicKey,
  rent: PublicKey,
  eventAuthority: PublicKey,
}