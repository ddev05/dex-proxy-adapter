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

// Tick Type
export type Tick = {
    tick: number;                     // i32
    liquidityNet: BigInt;                 // i128
    liquidityGross: BigInt;               // u128
    feeGrowthOutside0X64: BigInt;         // u128
    feeGrowthOutside1X64: BigInt;         // u128
    rewardGrowthsOutsideX64: BigInt[];
    padding: number[]
};

// TickArray Type
export type TickArray = {
    poolId: PublicKey;                // publicKey
    startTickIndex: number;           // i32
    ticks: Tick[];                    // Tick[TICK_ARRAY_SIZE]
    initializedTickCount: number;     // u8
    recentEpoch: bigint;                  // u64
    padding: number[];                // u8[107]
};

// Layout Definition Type (for reference)
export type TickArrayLayout = {
    discriminator: number[];          // u8[8]
    poolId: PublicKey;                // publicKey
    startTickIndex: number;           // i32
    ticks: Tick[];                    // Tick[TICK_ARRAY_SIZE]
    initializedTickCount: number;     // u8
    recentEpoch: BN;                  // u64
    padding: number[];                // u8[107]
};


// Helper types for buffer parsing
export type BufferLayout = {
    span: number;
    property?: string;
    type: string;
    values?: any[];
};

export interface StepComputations {
    sqrtPriceStartX64: BN
    tickNext: number
    initialized: boolean
    sqrtPriceNextX64: BN
    amountIn: BN
    amountOut: BN
    feeAmount: BN
}


export interface SwapStep {
    sqrtPriceX64Next: BN
    amountIn: BN
    amountOut: BN
    feeAmount: BN
}


export interface RaydiumClmmAccountKeys {
    inputMint: PublicKey
    payer: PublicKey
    remainingAccounts ?: Array<PublicKey>,
    xPrice : BN
}

export interface AmmConfig {
    bump: number;
    index: number;
    owner: PublicKey;
    protocolFeeRate: number;
    tradeFeeRate: number;
    tickSpacing: number;
    fundFeeRate: number;
    paddingU32: number;
    fundOwner: PublicKey;
    padding: Buffer;
}
