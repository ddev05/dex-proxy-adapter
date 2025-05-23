import { FEE_RATE_DENOMINATOR_VALUE } from "../../pump-fun/src";
import BigNumber from "bignumber.js";

export function getAmountOut({
    amountIn,
    inputReserve,
    outputReserve,
}: {
    amountIn: BigNumber;
    inputReserve: BigNumber;
    outputReserve: BigNumber;
}): BigNumber {
    const numerator = amountIn.times(outputReserve);
    const denominator = inputReserve.plus(amountIn);
    const amountOut = numerator.div(denominator);
    return amountOut;
}

export function calculateFee({ amount, feeRate }: { amount: BigNumber; feeRate: BigNumber }): BigNumber {
    return ceilDiv(amount, feeRate, FEE_RATE_DENOMINATOR_VALUE);
}

export function ceilDiv(
    tokenAmount: BigNumber,
    feeNumerator: BigNumber,
    feeDenominator: BigNumber
): BigNumber {
    return tokenAmount
        .multipliedBy(feeNumerator)
        .plus(feeDenominator)
        .minus(1)
        .dividedToIntegerBy(feeDenominator);
}
