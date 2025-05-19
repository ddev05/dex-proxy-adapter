import { PublicKey } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { BootstrappingInfo, MeteoraPoolInfo, PartnerInfo, PoolFees } from './types';

// Helper functions
function readU8(buf: Buffer, offset: number): number {
    return buf.readUInt8(offset);
}

function readU64(buf: Buffer, offset: number): BigNumber {
    const hex = buf.slice(offset, offset + 8).reverse().toString('hex');
    return new BigNumber(hex || '0', 16);
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
    return new PublicKey(buf.slice(offset, offset + 32));
}


export function parsePoolAccount(buf: Buffer): MeteoraPoolInfo {
    let offset = 8;

    const lpMint = readPubkey(buf, offset); offset += 32;
    const tokenAMint = readPubkey(buf, offset); offset += 32;
    const tokenBMint = readPubkey(buf, offset); offset += 32;

    const aVault = readPubkey(buf, offset); offset += 32;
    const bVault = readPubkey(buf, offset); offset += 32;
    const aVaultLp = readPubkey(buf, offset); offset += 32;
    const bVaultLp = readPubkey(buf, offset); offset += 32;

    const aVaultLpBump = readU8(buf, offset); offset += 1;
    const enabled = !!readU8(buf, offset); offset += 1;

    const protocolTokenAFee = readPubkey(buf, offset); offset += 32;
    const protocolTokenBFee = readPubkey(buf, offset); offset += 32;

    const feeLastUpdatedAt = readU64(buf, offset); offset += 8;

    offset += 24; // padding0 (u8[24])

    // Fees
    const tradeFeeNumerator = readU64(buf, offset); offset += 8;
    const tradeFeeDenominator = readU64(buf, offset); offset += 8;
    const protocolTradeFeeNumerator = readU64(buf, offset); offset += 8;
    const protocolTradeFeeDenominator = readU64(buf, offset); offset += 8;

    const fees: PoolFees = {
        tradeFeeNumerator,
        tradeFeeDenominator,
        protocolTradeFeeNumerator,
        protocolTradeFeeDenominator,
    };

    const poolTypeTag = readU8(buf, offset); offset += 1;
    const poolType = poolTypeTag === 0 ? 'permissionless' : 'other';

    const stake = readPubkey(buf, offset); offset += 32;
    const totalLockedLp = readU64(buf, offset); offset += 8;

    // Bootstrapping
    const activationPoint = readU64(buf, offset); offset += 8;
    const whitelistedVault = readPubkey(buf, offset); offset += 32;
    const poolCreator = readPubkey(buf, offset); offset += 32;
    const activationType = readU8(buf, offset); offset += 1;

    offset += 7; // assumed alignment padding

    const bootstrapping: BootstrappingInfo = {
        activationPoint,
        whitelistedVault,
        poolCreator,
        activationType,
    };

    // PartnerInfo
    const feeNumerator = readU64(buf, offset); offset += 8;
    const partnerAuthority = readPubkey(buf, offset); offset += 32;
    const pendingFeeA = readU64(buf, offset); offset += 8;
    const pendingFeeB = readU64(buf, offset); offset += 8;

    const partnerInfo: PartnerInfo = {
        feeNumerator,
        partnerAuthority,
        pendingFeeA,
        pendingFeeB,
    };

    offset += 6; // padding0 (u8[6])
    offset += 8 * 21; // padding1 (u64[21])
    offset += 8 * 21; // padding2 (u64[21])

    const curveTag = readU8(buf, offset); offset += 1;
    const curveType = curveTag === 0 ? 'constantProduct' : 'stable';

    return {
        lpMint,
        tokenAMint,
        tokenBMint,
        aVault,
        bVault,
        aVaultLp,
        bVaultLp,
        aVaultLpBump,
        enabled,
        protocolTokenAFee,
        protocolTokenBFee,
        feeLastUpdatedAt,
        fees,
        poolType,
        stake,
        totalLockedLp,
        bootstrapping,
        partnerInfo,
        curveType,
    };
}