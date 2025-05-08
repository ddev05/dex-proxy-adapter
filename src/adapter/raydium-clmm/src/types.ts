import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export interface RewardInfo {
    rewardState: number;
    openTime: bigint;
    endTime: bigint;
    lastUpdateTime: bigint;
    emissionsPerSecondX64: bigint;
    rewardTotalEmissioned: bigint;
    rewardClaimed: bigint;
    tokenMint: PublicKey;
    tokenVault: PublicKey;
    creator: PublicKey;
    rewardGrowthGlobalX64: bigint;
}

export interface PoolInfo {
    bump: number;
    ammConfig: PublicKey;
    creator: PublicKey;
    mintA: PublicKey;
    mintB: PublicKey;
    vaultA: PublicKey;
    vaultB: PublicKey;
    observationId: PublicKey;
    mintDecimalsA: number;
    mintDecimalsB: number;
    tickSpacing: number;
    liquidity: bigint;
    sqrtPriceX64: bigint;
    tickCurrent: number;
    observationIndex: number;
    observationUpdateDuration: number;
    feeGrowthGlobalX64A: bigint;
    feeGrowthGlobalX64B: bigint;
    protocolFeesTokenA: bigint;
    protocolFeesTokenB: bigint;
    swapInAmountTokenA: bigint;
    swapOutAmountTokenB: bigint;
    swapInAmountTokenB: bigint;
    swapOutAmountTokenA: bigint;
    status: number;
    rewardInfos: RewardInfo[];
    tickArrayBitmap: bigint[];
    totalFeesTokenA: bigint;
    totalFeesClaimedTokenA: bigint;
    totalFeesTokenB: bigint;
    totalFeesClaimedTokenB: bigint;
    fundFeesTokenA: bigint;
    fundFeesTokenB: bigint;
    startTime: bigint;
    padding: bigint[];
}

export interface TickArrayBitmapExtensionType {
    poolId: PublicKey
    positiveTickArrayBitmap: BN[][]
    negativeTickArrayBitmap: BN[][]
}

export interface TickArrayBitmapExtension {
    poolId: PublicKey;
    positiveTickArrayBitmap: BN[][];
    negativeTickArrayBitmap: BN[][];
  }