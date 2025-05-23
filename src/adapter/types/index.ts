import BigNumber from "bignumber.js";

export interface PoolReserves {
    token0: string;
    token1: string;
    reserveToken0: BigNumber;
    reserveToken1: BigNumber;
}