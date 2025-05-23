import { PublicKey } from "@solana/web3.js";
import { PumpBondingCurveInfo } from "./types";
import { readBool, readPubkey, readU64BN } from "@/adapter/utils/parse";

export function parseBondingCurve(buffer: Buffer): PumpBondingCurveInfo {
  let offset = 8; // skip discriminator or padding

  const virtual_token_reserves = readU64BN(buffer, offset);
  offset += 8;

  const virtual_sol_reserves = readU64BN(buffer, offset);
  offset += 8;

  const real_token_reserves = readU64BN(buffer, offset);
  offset += 8;

  const real_sol_reserves = readU64BN(buffer, offset);
  offset += 8;

  const token_total_supply = readU64BN(buffer, offset);
  offset += 8;

  const complete = readBool(buffer, offset);
  offset += 1;

  let creator: PublicKey | undefined = undefined;
  if (offset + 32 <= buffer.length) {
    creator = readPubkey(buffer, offset);
  }

  return {
    virtual_token_reserves,
    virtual_sol_reserves,
    real_token_reserves,
    real_sol_reserves,
    token_total_supply,
    complete,
    creator
  };
}