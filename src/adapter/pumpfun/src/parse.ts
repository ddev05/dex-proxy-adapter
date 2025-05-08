import { PumpBondingCurveInfo } from "./types";

export function parseBondingCurve(buffer: Buffer): PumpBondingCurveInfo {
  let offset = 0;

  function readU64(): bigint {
    const value = buffer.readBigUInt64LE(offset);
    offset += 8;
    return value;
  }

  function readBool(): boolean {
    const value = buffer.readUInt8(offset);
    offset += 1;
    return value !== 0;
  }

  const curve: PumpBondingCurveInfo = {
    virtual_token_reserves: readU64(),
    virtual_sol_reserves: readU64(),
    real_token_reserves: readU64(),
    real_sol_reserves: readU64(),
    token_total_supply: readU64(),
    complete: readBool(),
  };

  return curve;
}