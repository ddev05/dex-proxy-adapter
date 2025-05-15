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
  curveType: 'constantProduct' | 'unknown';
}

export interface MeteoraSwapAccount {
    inputMint : PublicKey;
    pool : PublicKey;
    baseMint : PublicKey;
    quoteMint : PublicKey;
    baseTokenProgram : PublicKey;
    quoteTokenProgram : PublicKey;
    user : PublicKey;
}