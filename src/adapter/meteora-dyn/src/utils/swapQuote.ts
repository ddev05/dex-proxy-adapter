import { PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { MeteoraPoolInfo, TradeDirection } from "../types";

export const calculateTradingFee = (amount: BigNumber, poolState: MeteoraPoolInfo): BigNumber => {
  const { tradeFeeDenominator, tradeFeeNumerator } = poolState.fees;
  return amount.times(tradeFeeNumerator).div(tradeFeeDenominator);
};

export const calculateProtocolTradingFee = (amount: BigNumber, poolState: MeteoraPoolInfo): BigNumber => {
  const { protocolTradeFeeDenominator, protocolTradeFeeNumerator } = poolState.fees;
  return amount.times(protocolTradeFeeNumerator).div(protocolTradeFeeDenominator);
};

export function getUnmintAmount(amount: BigNumber, withdrawableAmount: BigNumber, totalSupply: BigNumber) {
  return amount.times(totalSupply).div(withdrawableAmount);
}

export const calculateMaxSwapOutAmount = (
  tokenMint: PublicKey,
  tokenAMint: PublicKey,
  tokenBMint: PublicKey,
  tokenAAmount: BigNumber,
  tokenBAmount: BigNumber,
  vaultAReserve: BigNumber,
  vaultBReserve: BigNumber,
) => {
  if (!tokenMint.equals(tokenAMint) && !tokenMint.equals(tokenBMint)) {
    throw new Error("INVALID_MINT");
  }

  const [outTotalAmount, outReserveBalance] = tokenMint.equals(tokenAMint)
    ? [tokenAAmount, vaultAReserve]
    : [tokenBAmount, vaultBReserve];

  return outTotalAmount.gt(outReserveBalance) ? outReserveBalance : outTotalAmount;
};

export function computeOutAmount(
  sourceAmount: BigNumber,
  swapSourceAmount: BigNumber,
  swapDestinationAmount: BigNumber,
  _tradeDirection: TradeDirection,
) {
  let invariant = swapSourceAmount.times(swapDestinationAmount);
  let newSwapDestinationAmount = (invariant.div(swapSourceAmount.plus(sourceAmount))).integerValue();
  let destinationAmountSwapped = swapDestinationAmount.minus(newSwapDestinationAmount);
  if (destinationAmountSwapped.eq(new BigNumber(0))) {
    throw new Error('Swap result in zero');
  }

  return destinationAmountSwapped
}