import { PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";

export interface GlobalConfigAccount {
    epoch: BigNumber;
    curveType: number;
    index: number;
    migrateFee: BigNumber;
    tradeFeeRate: BigNumber;
    maxShareFeeRate: BigNumber;
    minBaseSupply: BigNumber;
    maxLockRate: BigNumber;
    minBaseSellRate: BigNumber;
    minBaseMigrateRate: BigNumber;
    minQuoteFundRaising: BigNumber;
    quoteMint: PublicKey;
    protocolFeeOwner: PublicKey;
    migrateFeeOwner: PublicKey;
    migrateToAmmWallet: PublicKey;
    migrateToCpswapWallet: PublicKey;
    padding: BigNumber[];
}

export interface PlatformConfigAccount {
    epoch: BigNumber;
    platformFeeWallet: PublicKey;
    platformNftWallet: PublicKey;
    platformScale: BigNumber;
    creatorScale: BigNumber;
    burnScale: BigNumber;
    feeRate: BigNumber;
    name: string;
    web: string;
    img: string;
}



export interface VestingSchedule {
    totalLockedAmount: BigNumber;
    cliffPeriod: BigNumber;
    unlockPeriod: BigNumber;
    startTime: BigNumber;
    allocatedShareAmount: BigNumber;
}

export interface PoolStateAccount {
    epoch: BigNumber;
    authBump: number;
    status: number;
    baseDecimals: number;
    quoteDecimals: number;
    migrateType: number;
    supply: BigNumber;
    totalBaseSell: BigNumber;
    virtualBase: BigNumber;
    virtualQuote: BigNumber;
    realBase: BigNumber;
    realQuote: BigNumber;
    totalQuoteFundRaising: BigNumber;
    quoteProtocolFee: BigNumber;
    platformFee: BigNumber;
    migrateFee: BigNumber;
    vestingSchedule: VestingSchedule;
    globalConfig: PublicKey;
    platformConfig: PublicKey;
    baseMint: PublicKey;
    quoteMint: PublicKey;
    baseVault: PublicKey;
    quoteVault: PublicKey;
    creator: PublicKey;
}

export interface RaydiumLaunchPadAccountKeys {
    inputMint : PublicKey,
    payer : PublicKey
}