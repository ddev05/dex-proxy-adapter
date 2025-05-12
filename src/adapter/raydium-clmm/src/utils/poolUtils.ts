import BN from "bn.js"
import { PoolInfo, TickArray, TickArrayBitmapExtensionType } from "../types"
import { PublicKey } from "@solana/web3.js"
import { getPdaTickArrayAddress } from "./pda"
import { MAX_SQRT_PRICE_X64, MIN_SQRT_PRICE_X64, RAYDIUM_CLMM_DEVNET_ADDR, RAYDIUM_CLMM_MAINNET_ADDR, TICK_ARRAY_SIZE, } from "../constants"
import { checkTickArrayIsInit, checkTickArrayIsInitialized, getArrayStartIndex, isOverflowDefaultTickarrayBitmap, nextInitializedTickArrayStartIndexPoolUtils } from "./utils"
import { swapCompute } from "./tick"

export function getOutputAmountAndRemainAccounts(
    poolInfo: PoolInfo,
    poolId: PublicKey,
    tickArrayCache: { [key: string]: TickArray },
    tickArrayBitmap: BN[],
    exBitmapInfo: TickArrayBitmapExtensionType,
    inputTokenMint: PublicKey,
    inputAmount: BN,
    tradeFeeRate: number,
    sqrtPriceLimitX64: BN,
    cluster: "mainnet" | "devnet"
): {
    allTrade: boolean
    realTradeAmountIn: BN
    expectedAmountOut: BN
    remainingAccounts: PublicKey[]
    executionPrice: BN
    feeAmount: BN,
} {
    const zeroForOne = inputTokenMint.equals(poolInfo.mintA)
    const raydiumProgramID = cluster == "mainnet" ? RAYDIUM_CLMM_MAINNET_ADDR : RAYDIUM_CLMM_DEVNET_ADDR

    const allNeededAccounts: PublicKey[] = []
    const {
        isExist,
        startIndex: firstTickArrayStartIndex,
        nextAccountMeta,
    } = getFirstInitializedTickArray(poolInfo, poolId, tickArrayBitmap, exBitmapInfo, zeroForOne, cluster)



    if (!isExist || firstTickArrayStartIndex === undefined || !nextAccountMeta) throw new Error('Invalid tick array')

    try {
        const preTick = preInitializedTickArrayStartIndex(poolInfo, tickArrayBitmap, exBitmapInfo, zeroForOne)

        if (preTick.isExist) {
            const [address] = getPdaTickArrayAddress(raydiumProgramID, poolId, preTick.nextStartIndex)

            allNeededAccounts.push(address)
        }
    } catch (e) {
        /* empty */
    }

    allNeededAccounts.push(nextAccountMeta)
    const {
        allTrade,
        amountSpecifiedRemaining,
        amountCalculated: outputAmount,
        accounts: reaminAccounts,
        sqrtPriceX64: executionPrice,
        feeAmount,
    } = swapCompute(
        raydiumProgramID,
        poolId,
        tickArrayCache,
        tickArrayBitmap,
        exBitmapInfo,
        zeroForOne,
        tradeFeeRate,
        new BN(poolInfo.liquidity.toString()),
        poolInfo.tickCurrent,
        poolInfo.tickSpacing,
        new BN(poolInfo.sqrtPriceX64.toString()),
        inputAmount,
        firstTickArrayStartIndex,
        sqrtPriceLimitX64,
    )

    allNeededAccounts.push(...reaminAccounts)
    return {
        allTrade,
        realTradeAmountIn: inputAmount.sub(amountSpecifiedRemaining),
        expectedAmountOut: outputAmount.mul(new BN(-1)),
        remainingAccounts: allNeededAccounts,
        executionPrice,
        feeAmount,
    }
}

export function nextInitializedTickArray(
    tickIndex: number,
    tickSpacing: number,
    zeroForOne: boolean,
    tickArrayBitmap: BN[],
    exBitmapInfo: TickArrayBitmapExtensionType,
) {


    const currentOffset = Math.floor(tickIndex / (TICK_ARRAY_SIZE * tickSpacing))
    const result: number[] = zeroForOne
        ? searchLowBitFromStart(tickArrayBitmap, exBitmapInfo, currentOffset - 1, 1, tickSpacing)
        : searchHightBitFromStart(tickArrayBitmap, exBitmapInfo, currentOffset + 1, 1, tickSpacing)

    return result.length > 0 ? { isExist: true, nextStartIndex: result[0] } : { isExist: false, nextStartIndex: 0 }
}


export function preInitializedTickArrayStartIndex(poolInfo: PoolInfo, tickArrayBitmap: BN[], exBitmapInfo: TickArrayBitmapExtensionType, zeroForOne: boolean) {
    const currentOffset = Math.floor(poolInfo.tickCurrent / (TICK_ARRAY_SIZE * poolInfo.tickSpacing))

    const result: number[] = !zeroForOne
        ? searchLowBitFromStart(
            tickArrayBitmap,
            exBitmapInfo,
            currentOffset - 1,
            1,
            poolInfo.tickSpacing,
        )
        : searchHightBitFromStart(
            tickArrayBitmap,
            exBitmapInfo,
            currentOffset + 1,
            1,
            poolInfo.tickSpacing,
        )

    return result.length > 0 ? { isExist: true, nextStartIndex: result[0] } : { isExist: false, nextStartIndex: 0 }
}

export function searchLowBitFromStart(
    tickArrayBitmap: BN[],
    exTickArrayBitmap: TickArrayBitmapExtensionType,
    currentTickArrayBitStartIndex: number,
    expectedCount: number,
    tickSpacing: number,
) {
    const tickArrayBitmaps = [
        ...[...exTickArrayBitmap.negativeTickArrayBitmap].reverse(),
        tickArrayBitmap.slice(0, 8),
        tickArrayBitmap.slice(8, 16),
        ...exTickArrayBitmap.positiveTickArrayBitmap,
    ].map((i) => mergeTickArrayBitmap(i))
    const result: number[] = []
    while (currentTickArrayBitStartIndex >= -7680) {
        const arrayIndex = Math.floor((currentTickArrayBitStartIndex + 7680) / 512)
        const searchIndex = (currentTickArrayBitStartIndex + 7680) % 512

        if (tickArrayBitmaps[arrayIndex].testn(searchIndex)) result.push(currentTickArrayBitStartIndex)

        currentTickArrayBitStartIndex--
        if (result.length === expectedCount) break
    }

    const tickCount = TICK_ARRAY_SIZE * tickSpacing
    return result.map((i) => i * tickCount)
}

export function searchHightBitFromStart(
    tickArrayBitmap: BN[],
    exTickArrayBitmap: TickArrayBitmapExtensionType,
    currentTickArrayBitStartIndex: number,
    expectedCount: number,
    tickSpacing: number,
) {
    const tickArrayBitmaps = [
        ...[...exTickArrayBitmap.negativeTickArrayBitmap].reverse(),
        tickArrayBitmap.slice(0, 8),
        tickArrayBitmap.slice(8, 16),
        ...exTickArrayBitmap.positiveTickArrayBitmap,
    ].map((i) => mergeTickArrayBitmap(i))
    const result: number[] = []
    while (currentTickArrayBitStartIndex < 7680) {
        const arrayIndex = Math.floor((currentTickArrayBitStartIndex + 7680) / 512)
        const searchIndex = (currentTickArrayBitStartIndex + 7680) % 512

        if (tickArrayBitmaps[arrayIndex].testn(searchIndex)) result.push(currentTickArrayBitStartIndex)

        currentTickArrayBitStartIndex++
        if (result.length === expectedCount) break
    }

    const tickCount = TICK_ARRAY_SIZE * tickSpacing
    return result.map((i) => i * tickCount)
}

export function mergeTickArrayBitmap(bns: BN[]) {
    let b = new BN(0)
    for (let i = 0; i < bns.length; i++) {
        b = b.add(bns[i].shln(64 * i))
    }
    return b
}

export function getFirstInitializedTickArray(
    poolInfo: PoolInfo,
    poolId: PublicKey,
    tickArrayBitmap: BN[],
    exBitmapInfo: TickArrayBitmapExtensionType,
    zeroForOne: boolean,
    cluster: "mainnet" | "devnet"
):
    | { isExist: true; startIndex: number; nextAccountMeta: PublicKey }
    | { isExist: false; startIndex: undefined; nextAccountMeta: undefined } {
    const { isInitialized, startIndex } = isOverflowDefaultTickarrayBitmap(poolInfo.tickSpacing, [
        poolInfo.tickCurrent,
    ])
        ? checkTickArrayIsInit(
            getArrayStartIndex(poolInfo.tickCurrent, poolInfo.tickSpacing),
            poolInfo.tickSpacing,
            exBitmapInfo,
        )
        : checkTickArrayIsInitialized(
            mergeTickArrayBitmap(tickArrayBitmap),
            poolInfo.tickCurrent,
            poolInfo.tickSpacing,
        )

    const raydiumProgramID = cluster == "mainnet" ? RAYDIUM_CLMM_MAINNET_ADDR : RAYDIUM_CLMM_DEVNET_ADDR

    if (isInitialized) {
        const [address] = getPdaTickArrayAddress(raydiumProgramID, poolId, startIndex)
        return {
            isExist: true,
            startIndex,
            nextAccountMeta: address,
        }
    }

    const { isExist, nextStartIndex } = nextInitializedTickArrayStartIndexPoolUtils(
        {
            exBitmapInfo,
            tickArrayBitmap,
            tickCurrent: poolInfo.tickCurrent,
            tickSpacing: poolInfo.tickSpacing
        },
        getArrayStartIndex(poolInfo.tickCurrent, poolInfo.tickSpacing),
        zeroForOne,
    )
    if (isExist) {
        const [address] = getPdaTickArrayAddress(raydiumProgramID, poolId, nextStartIndex)

        return {
            isExist: true,
            startIndex: nextStartIndex,
            nextAccountMeta: address,
        }
    }
    return { isExist: false, nextAccountMeta: undefined, startIndex: undefined }
}

export function computeAmountOut({
    poolInfo,
    poolId,
    tickArrayCache,
    tickArrayBitmap,
    exBitmapInfo,
    baseMint,
    amountIn,
    tradeFeeRate,
    slippage,
    cluster
}: {
    poolInfo: PoolInfo
    poolId: PublicKey
    tickArrayCache: { [key: string]: TickArray }
    tickArrayBitmap: BN[]
    exBitmapInfo: TickArrayBitmapExtensionType
    baseMint: PublicKey
    amountIn: BN
    slippage: number,
    tradeFeeRate: number,
    cluster: "mainnet" | "devnet"
}): {
    allTrade: boolean,
    minAmountOut: BN,
    fee: BN,
    remainingAccounts: PublicKey[]
    executionPriceX64: BN
} {
    const sqrtPriceLimitX64 = baseMint.equals(poolInfo.mintA) ? MIN_SQRT_PRICE_X64.add(new BN(1)) : MAX_SQRT_PRICE_X64.sub(new BN(1))

    const {
        allTrade,
        realTradeAmountIn,
        expectedAmountOut: _expectedAmountOut,
        remainingAccounts,
        executionPrice: _executionPriceX64,
        feeAmount,
    } = getOutputAmountAndRemainAccounts(
        poolInfo,
        poolId,
        tickArrayCache,
        tickArrayBitmap,
        exBitmapInfo,
        baseMint,
        amountIn,
        tradeFeeRate,
        sqrtPriceLimitX64,
        cluster
    )

    const minAmountOut = _expectedAmountOut
        .mul(new BN(Math.floor((1 - slippage) * 10000000000)))
        .div(new BN(10000000000))


    return {
        allTrade,
        minAmountOut: minAmountOut,
        fee: feeAmount,
        remainingAccounts,
        executionPriceX64: _executionPriceX64,
    }
}