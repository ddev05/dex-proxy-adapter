import { PublicKey } from "@solana/web3.js";
import { PoolInfo, RewardInfo, TickArrayBitmapExtension } from "./types"; // define these interfaces in `types.ts`
import { EXTENSION_TICKARRAY_BITMAP_SIZE } from "./constants";
import BN from "bn.js";

export function parsePoolInfo(buffer: Buffer): PoolInfo {
    let offset = 0;

    const skip = (bytes: number) => (offset += bytes);
    const readU8 = () => buffer.readUInt8(offset++);
    const readU16 = () => (offset += 2, buffer.readUInt16LE(offset - 2));
    const readS32 = () => (offset += 4, buffer.readInt32LE(offset - 4));
    const readU64 = () => (offset += 8, buffer.readBigUInt64LE(offset - 8));
    const readU128 = () => {
        const lo = buffer.readBigUInt64LE(offset);
        const hi = buffer.readBigUInt64LE(offset + 8);
        offset += 16;
        return (hi << BigInt(64)) + lo;
    };
    const readPublicKey = () => {
        const key = new PublicKey(buffer.slice(offset, offset + 32));
        offset += 32;
        return key;
    };

    skip(8); // skip discriminator or reserved
    const bump = readU8();
    const ammConfig = readPublicKey();
    const creator = readPublicKey();
    const mintA = readPublicKey();
    const mintB = readPublicKey();
    const vaultA = readPublicKey();
    const vaultB = readPublicKey();
    const observationId = readPublicKey();
    const mintDecimalsA = readU8();
    const mintDecimalsB = readU8();
    const tickSpacing = readU16();
    const liquidity = readU128();
    const sqrtPriceX64 = readU128();
    const tickCurrent = readS32();
    const observationIndex = readU16();
    const observationUpdateDuration = readU16();
    const feeGrowthGlobalX64A = readU128();
    const feeGrowthGlobalX64B = readU128();
    const protocolFeesTokenA = readU64();
    const protocolFeesTokenB = readU64();
    const swapInAmountTokenA = readU128();
    const swapOutAmountTokenB = readU128();
    const swapInAmountTokenB = readU128();
    const swapOutAmountTokenA = readU128();
    const status = readU8();
    skip(7); // skip 7-byte padding

    const rewardInfos: RewardInfo[] = [];
    for (let i = 0; i < 3; i++) {
        const rewardState = readU8();
        const openTime = readU64();
        const endTime = readU64();
        const lastUpdateTime = readU64();
        const emissionsPerSecondX64 = readU128();
        const rewardTotalEmissioned = readU64();
        const rewardClaimed = readU64();
        const tokenMint = readPublicKey();
        const tokenVault = readPublicKey();
        const rewardCreator = readPublicKey();
        const rewardGrowthGlobalX64 = readU128();

        rewardInfos.push({
            rewardState,
            openTime,
            endTime,
            lastUpdateTime,
            emissionsPerSecondX64,
            rewardTotalEmissioned,
            rewardClaimed,
            tokenMint,
            tokenVault,
            creator: rewardCreator,
            rewardGrowthGlobalX64,
        });
    }

    const tickArrayBitmap: bigint[] = [];
    for (let i = 0; i < 16; i++) {
        tickArrayBitmap.push(readU64());
    }

    const totalFeesTokenA = readU64();
    const totalFeesClaimedTokenA = readU64();
    const totalFeesTokenB = readU64();
    const totalFeesClaimedTokenB = readU64();
    const fundFeesTokenA = readU64();
    const fundFeesTokenB = readU64();
    const startTime = readU64();

    const padding: bigint[] = [];
    for (let i = 0; i < 15 * 4 - 3; i++) {
        padding.push(readU64());
    }

    return {
        bump,
        ammConfig,
        creator,
        mintA,
        mintB,
        vaultA,
        vaultB,
        observationId,
        mintDecimalsA,
        mintDecimalsB,
        tickSpacing,
        liquidity,
        sqrtPriceX64,
        tickCurrent,
        observationIndex,
        observationUpdateDuration,
        feeGrowthGlobalX64A,
        feeGrowthGlobalX64B,
        protocolFeesTokenA,
        protocolFeesTokenB,
        swapInAmountTokenA,
        swapOutAmountTokenB,
        swapInAmountTokenB,
        swapOutAmountTokenA,
        status,
        rewardInfos,
        tickArrayBitmap,
        totalFeesTokenA,
        totalFeesClaimedTokenA,
        totalFeesTokenB,
        totalFeesClaimedTokenB,
        fundFeesTokenA,
        fundFeesTokenB,
        startTime,
        padding,
    };
}


export function parseTickArrayBitmapExtension(buffer: Buffer): TickArrayBitmapExtension {
  let offset = 0;

  function readBlob(length: number): Buffer {
    const value = buffer.slice(offset, offset + length);
    offset += length;
    return value;
  }

  function readBN(): BN {
    const value = new BN(buffer.slice(offset, offset + 8), 'le');
    offset += 8;
    return value;
  }

  function readPublicKey(): PublicKey {
    const key = buffer.slice(offset, offset + 32);
    offset += 32;
    return new PublicKey(key);
  }

  function readBitmapArray(): BN[][] {
    const outer: BN[][] = [];
    for (let i = 0; i < EXTENSION_TICKARRAY_BITMAP_SIZE; i++) {
      const inner: BN[] = [];
      for (let j = 0; j < 8; j++) {
        inner.push(readBN());
      }
      outer.push(inner);
    }
    return outer;
  }

  readBlob(8); // Skip 8-byte blob

  const poolId = readPublicKey();
  const positiveTickArrayBitmap = readBitmapArray();
  const negativeTickArrayBitmap = readBitmapArray();

  return {
    poolId,
    positiveTickArrayBitmap,
    negativeTickArrayBitmap,
  };
}
