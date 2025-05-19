import { PublicKey } from "@solana/web3.js";

// Types
export interface PoolFees {
  tradeFeeNumerator: BigNumber;
  tradeFeeDenominator: BigNumber;
  protocolTradeFeeNumerator: BigNumber;
  protocolTradeFeeDenominator: BigNumber;
}

export interface BootstrappingInfo {
  activationPoint: BigNumber;
  whitelistedVault: PublicKey;
  poolCreator: PublicKey;
  activationType: number;
}

export interface PartnerInfo {
  feeNumerator: BigNumber;
  partnerAuthority: PublicKey;
  pendingFeeA: BigNumber;
  pendingFeeB: BigNumber;
}

export interface MeteoraPoolInfo {
  lpMint: PublicKey;
  tokenAMint: PublicKey;
  tokenBMint: PublicKey;
  aVault: PublicKey;
  bVault: PublicKey;
  aVaultLp: PublicKey;
  bVaultLp: PublicKey;
  aVaultLpBump: number;
  enabled: boolean;
  protocolTokenAFee: PublicKey;
  protocolTokenBFee: PublicKey;
  feeLastUpdatedAt: BigNumber;
  fees: PoolFees;
  poolType: 'permissionless' | 'other';
  stake: PublicKey;
  totalLockedLp: BigNumber;
  bootstrapping: BootstrappingInfo;
  partnerInfo: PartnerInfo;
  curveType: 'constantProduct' | 'stable';
}

export interface MeteoraSwapAccount {
  inputMint: PublicKey;
  user: PublicKey;
}

export interface VaultBumps {
  vaultBump: number;
  tokenVaultBump: number;
}

export interface LockedProfitTracker {
  lastUpdatedLockedProfit: BigNumber;
  lastReport: BigNumber;
  lockedProfitDegradation: BigNumber;
}

export interface VaultAccount {
  enabled: number;
  bumps: VaultBumps;
  totalAmount: BigNumber;
  tokenVault: PublicKey;
  feeVault: PublicKey;
  tokenMint: PublicKey;
  lpMint: PublicKey;
  strategies: PublicKey[];
  base: PublicKey;
  admin: PublicKey;
  operator: PublicKey;
  lockedProfitTracker: LockedProfitTracker;
}

export interface PoolInformation {
  tokenAAmount: BigNumber,
  tokenBAmount: BigNumber,
  virtualPrice: number,
  virtualPriceRaw: BigNumber,
}

export enum TradeDirection {
  AToB,
  BToA,
}