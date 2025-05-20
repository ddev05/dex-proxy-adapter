import { PublicKey } from "@solana/web3.js";

export interface PumpBondingCurveInfo {
  virtual_token_reserves: bigint;
  virtual_sol_reserves: bigint;
  real_token_reserves: bigint;
  real_sol_reserves: bigint;
  token_total_supply: bigint;
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