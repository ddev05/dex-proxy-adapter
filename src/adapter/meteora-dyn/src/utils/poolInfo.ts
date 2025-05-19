import { LOCKED_PROFIT_DEGRADATION_DENOMINATOR, VIRTUAL_PRICE_PRECISION } from "../constants";
import { PoolInformation, VaultAccount } from "../types";
import BigNumber from "bignumber.js";

export function calculateWithdrawableAmount(onChainTime: number, vaultState: VaultAccount) {
    const {
        lockedProfitTracker: { lastReport, lockedProfitDegradation, lastUpdatedLockedProfit },
        totalAmount: vaultTotalAmount,
    } = vaultState;

    const duration = new BigNumber(onChainTime).minus(lastReport);

    const lockedFundRatio = duration.times(lockedProfitDegradation);
    if (lockedFundRatio.gt(LOCKED_PROFIT_DEGRADATION_DENOMINATOR)) {
        return vaultTotalAmount;
    }

    const lockedProfit = lastUpdatedLockedProfit
        .times(LOCKED_PROFIT_DEGRADATION_DENOMINATOR.minus(lockedFundRatio))
        .div(LOCKED_PROFIT_DEGRADATION_DENOMINATOR);

    return vaultTotalAmount.minus(lockedProfit);
}

export function getAmountByShare(amount: BigNumber, tokenAmount: BigNumber, lpSupply: BigNumber): BigNumber {
    if (lpSupply.isZero()) return new BigNumber(0);

    return (amount.times(tokenAmount).div(lpSupply)).integerValue();
}

export const calculatePoolInfo = (
    currentTimestamp: BigNumber,
    poolVaultALp: BigNumber,
    poolVaultBLp: BigNumber,
    vaultALpSupply: BigNumber,
    vaultBLpSupply: BigNumber,
    poolLpSupply: BigNumber,
    vaultA: VaultAccount,
    vaultB: VaultAccount,
) => {

    const vaultAWithdrawableAmount = calculateWithdrawableAmount(currentTimestamp.toNumber(), vaultA);
    const vaultBWithdrawableAmount = calculateWithdrawableAmount(currentTimestamp.toNumber(), vaultB);

    const tokenAAmount = getAmountByShare(poolVaultALp, vaultAWithdrawableAmount, vaultALpSupply).integerValue(BigNumber.ROUND_FLOOR);
    const tokenBAmount = getAmountByShare(poolVaultBLp, vaultBWithdrawableAmount, vaultBLpSupply).integerValue(BigNumber.ROUND_FLOOR);

    const d = (tokenAAmount.plus(tokenBAmount)).sqrt()

    const virtualPriceBigNum = poolLpSupply.isZero() ? new BigNumber(0) : d.times(VIRTUAL_PRICE_PRECISION).div(poolLpSupply);
    const virtualPrice = virtualPriceBigNum.div(VIRTUAL_PRICE_PRECISION.toString()).toNumber();
    const virtualPriceRaw = poolLpSupply.isZero() ? new BigNumber(0) : new BigNumber(2)
        .pow(64)                    // Equivalent to shln(64)
        .multipliedBy(d)
        .dividedBy(poolLpSupply);

    const poolInformation: PoolInformation = {
        tokenAAmount,
        tokenBAmount,
        virtualPrice,
        virtualPriceRaw,
    };

    return poolInformation;
};