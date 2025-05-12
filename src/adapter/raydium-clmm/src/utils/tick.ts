import BN from "bn.js"
import { FEE_RATE_DENOMINATOR, MAX_SQRT_PRICE_X64, MAX_TICK, MIN_SQRT_PRICE_X64, MIN_TICK, TICK_ARRAY_SIZE } from "../constants"
import { PublicKey } from "@solana/web3.js"
import { StepComputations, SwapStep, Tick, TickArray, TickArrayBitmapExtensionType } from "../types"
import { getPdaTickArrayAddress } from "./pda"
import { addDelta, getNextSqrtPriceX64FromInput, getNextSqrtPriceX64FromOutput, getSqrtPriceX64FromTick, getTickFromSqrtPriceX64, getTokenAmountAFromLiquidity, getTokenAmountBFromLiquidity, mulDivCeil, mulDivFloor } from "./math"
import { nextInitializedTickArrayStartIndexPoolUtils, nextInitTick } from "./utils"

export function swapCompute(
    programId: PublicKey,
    poolId: PublicKey,
    tickArrayCache: { [key: string]: TickArray },
    tickArrayBitmap: BN[],
    tickarrayBitmapExtension: TickArrayBitmapExtensionType,
    zeroForOne: boolean,
    fee: number,
    liquidity: BN,
    currentTick: number,
    tickSpacing: number,
    currentSqrtPriceX64: BN,
    amountSpecified: BN,
    lastSavedTickArrayStartIndex: number,
    sqrtPriceLimitX64?: BN,
    catchLiquidityInsufficient: boolean = false,
): {
    allTrade: boolean
    amountSpecifiedRemaining: BN
    amountCalculated: BN
    feeAmount: BN
    sqrtPriceX64: BN
    liquidity: BN
    tickCurrent: number
    accounts: PublicKey[]
} {
    if (amountSpecified.eq(new BN(0))) {
        throw new Error('amountSpecified must not be 0')
    }
    if (!sqrtPriceLimitX64) sqrtPriceLimitX64 = zeroForOne ? MIN_SQRT_PRICE_X64.add(new BN(1)) : MAX_SQRT_PRICE_X64.sub(new BN(1))

    if (zeroForOne) {
        if (sqrtPriceLimitX64.lt(MIN_SQRT_PRICE_X64)) {
            throw new Error('sqrtPriceX64 must greater than MIN_SQRT_PRICE_X64')
        }

        if (sqrtPriceLimitX64.gte(currentSqrtPriceX64)) {
            throw new Error('sqrtPriceX64 must smaller than current')
        }
    } else {
        if (sqrtPriceLimitX64.gt(MAX_SQRT_PRICE_X64)) {
            throw new Error('sqrtPriceX64 must smaller than MAX_SQRT_PRICE_X64')
        }

        if (sqrtPriceLimitX64.lte(currentSqrtPriceX64)) {
            throw new Error('sqrtPriceX64 must greater than current')
        }
    }
    const baseInput = amountSpecified.gt(new BN(0))

    const state = {
        amountSpecifiedRemaining: amountSpecified,
        amountCalculated: new BN(0),
        sqrtPriceX64: currentSqrtPriceX64,
        tick:
            currentTick > lastSavedTickArrayStartIndex
                ? Math.min(lastSavedTickArrayStartIndex + TICK_ARRAY_SIZE * tickSpacing - 1, currentTick)
                : lastSavedTickArrayStartIndex,
        accounts: [] as PublicKey[],
        liquidity,
        feeAmount: new BN(0),
    }
    let tickAarrayStartIndex = lastSavedTickArrayStartIndex
    let tickArrayCurrent = tickArrayCache[lastSavedTickArrayStartIndex]
    let loopCount = 0
    let t = !zeroForOne && tickArrayCurrent.startTickIndex === state.tick
    

    while (
        !state.amountSpecifiedRemaining.eq(new BN(0)) &&
        !state.sqrtPriceX64.eq(sqrtPriceLimitX64)
        // state.tick < MAX_TICK &&
        // state.tick > MIN_TICK
    ) {
        
        if (loopCount > 10) {
            // throw Error('liquidity limit')
        }
        const step: Partial<StepComputations> = {}
        step.sqrtPriceStartX64 = state.sqrtPriceX64

        const tickState: Tick | null = nextInitTick(tickArrayCurrent, state.tick, tickSpacing, zeroForOne, t)

        let nextInitTickData: Tick | null = tickState ? tickState : null // firstInitializedTick(tickArrayCurrent, zeroForOne)
        let tickArrayAddress = null
        

        if (!nextInitTickData || Number(nextInitTickData.liquidityGross) <= 0) {
            const nextInitTickArrayIndex = nextInitializedTickArrayStartIndexPoolUtils(
                {
                    tickCurrent: state.tick,
                    tickSpacing,
                    tickArrayBitmap,
                    exBitmapInfo: tickarrayBitmapExtension,
                },
                tickAarrayStartIndex,
                zeroForOne,
            )
            

            if (!nextInitTickArrayIndex.isExist) {
                if (catchLiquidityInsufficient) {
                    return {
                        allTrade: false,
                        amountSpecifiedRemaining: state.amountSpecifiedRemaining,
                        amountCalculated: state.amountCalculated,
                        feeAmount: state.feeAmount,
                        sqrtPriceX64: state.sqrtPriceX64,
                        liquidity: state.liquidity,
                        tickCurrent: state.tick,
                        accounts: state.accounts,
                    }
                }
                throw Error('swapCompute LiquidityInsufficient')
            }
            tickAarrayStartIndex = nextInitTickArrayIndex.nextStartIndex

            const [expectedNextTickArrayAddress] = getPdaTickArrayAddress(
                programId,
                poolId,
                tickAarrayStartIndex,
            )
            tickArrayAddress = expectedNextTickArrayAddress
            tickArrayCurrent = tickArrayCache[tickAarrayStartIndex]

            try {
                nextInitTickData = firstInitializedTick(tickArrayCurrent, zeroForOne)
            } catch (e) {
                throw Error('not found next tick info')
            }
        }

        step.tickNext = nextInitTickData.tick
        step.initialized = new BN(nextInitTickData.liquidityGross.toString()).gtn(0)

        if (lastSavedTickArrayStartIndex !== tickAarrayStartIndex && tickArrayAddress) {

            
            state.accounts.push(tickArrayAddress)
            lastSavedTickArrayStartIndex = tickAarrayStartIndex
        }
        if (step.tickNext < MIN_TICK) {
            step.tickNext = MIN_TICK
        } else if (step.tickNext > MAX_TICK) {
            step.tickNext = MAX_TICK
        }

        step.sqrtPriceNextX64 = getSqrtPriceX64FromTick(step.tickNext)
        let targetPrice: BN
        if (
            (zeroForOne && step.sqrtPriceNextX64.lt(sqrtPriceLimitX64)) ||
            (!zeroForOne && step.sqrtPriceNextX64.gt(sqrtPriceLimitX64))
        ) {
            targetPrice = sqrtPriceLimitX64
        } else {
            targetPrice = step.sqrtPriceNextX64
        }
        
        ;[state.sqrtPriceX64, step.amountIn, step.amountOut, step.feeAmount] = swapStepCompute(
            state.sqrtPriceX64,
            targetPrice,
            state.liquidity,
            state.amountSpecifiedRemaining,
            fee
        )

        state.feeAmount = state.feeAmount.add(step.feeAmount)

        if (baseInput) {
            state.amountSpecifiedRemaining = state.amountSpecifiedRemaining.sub(step.amountIn.add(step.feeAmount))
            state.amountCalculated = state.amountCalculated.sub(step.amountOut)
        } else {
            state.amountSpecifiedRemaining = state.amountSpecifiedRemaining.add(step.amountOut)
            state.amountCalculated = state.amountCalculated.add(step.amountIn.add(step.feeAmount))
        }
        if (state.sqrtPriceX64.eq(step.sqrtPriceNextX64)) {
            if (step.initialized) {
                let liquidityNet = new BN(nextInitTickData.liquidityNet.toString())
                if (zeroForOne) liquidityNet = liquidityNet.mul(new BN(-1))
                state.liquidity = addDelta(state.liquidity, liquidityNet)
            }

            t = step.tickNext != state.tick && !zeroForOne && tickArrayCurrent.startTickIndex === step.tickNext
            state.tick = zeroForOne ? step.tickNext - 1 : step.tickNext //
        } else if (state.sqrtPriceX64 != step.sqrtPriceStartX64) {
            const _T = getTickFromSqrtPriceX64(state.sqrtPriceX64)
            t = _T != state.tick && !zeroForOne && tickArrayCurrent.startTickIndex === _T
            state.tick = _T
        }
        ++loopCount
    }
    

    try {
        // const { nextStartIndex: tickAarrayStartIndex, isExist } = nextInitializedTickArray(
        //     state.tick,
        //     tickSpacing,
        //     zeroForOne,
        //     tickArrayBitmap,
        //     tickarrayBitmapExtension,
        // )
        // if (isExist && lastSavedTickArrayStartIndex !== tickAarrayStartIndex) {
        //     state.accounts.push(getPdaTickArrayAddress(programId, poolId, tickAarrayStartIndex)[0])
        //     lastSavedTickArrayStartIndex = tickAarrayStartIndex
        // }
    } catch (e) {
        /* empty */
    }

    


    return {
        allTrade: true,
        amountSpecifiedRemaining: new BN(0),
        amountCalculated: state.amountCalculated,
        feeAmount: state.feeAmount,
        sqrtPriceX64: state.sqrtPriceX64,
        liquidity: state.liquidity,
        tickCurrent: state.tick,
        accounts: state.accounts,
    }
}

export function firstInitializedTick(tickArrayCurrent: TickArray, zeroForOne: boolean) {
    if (zeroForOne) {
        let i = TICK_ARRAY_SIZE - 1
        while (i >= 0) {
            if (new BN(tickArrayCurrent.ticks[i].liquidityGross.toString()).gtn(0)) {
                return tickArrayCurrent.ticks[i]
            }
            i = i - 1
        }
    } else {
        let i = 0
        while (i < TICK_ARRAY_SIZE) {
            if (new BN(tickArrayCurrent.ticks[i].liquidityGross.toString()).gtn(0)) {
                return tickArrayCurrent.ticks[i]
            }
            i = i + 1
        }
    }

    throw Error(`firstInitializedTick check error: ${tickArrayCurrent} - ${zeroForOne}`)
}


export function swapStepCompute(
    sqrtPriceX64Current: BN,
    sqrtPriceX64Target: BN,
    liquidity: BN,
    amountRemaining: BN,
    feeRate : number
): [BN, BN, BN, BN] {
    const swapStep: SwapStep = {
        sqrtPriceX64Next: new BN(0),
        amountIn: new BN(0),
        amountOut: new BN(0),
        feeAmount: new BN(0),
    }

    const zeroForOne = sqrtPriceX64Current.gte(sqrtPriceX64Target)
    const baseInput = amountRemaining.gte(new BN(0))

    if (baseInput) {
        const amountRemainingSubtractFee = mulDivFloor(
            amountRemaining,
            FEE_RATE_DENOMINATOR.sub(new BN(feeRate.toString())),
            FEE_RATE_DENOMINATOR,
        )
        swapStep.amountIn = zeroForOne
            ? getTokenAmountAFromLiquidity(sqrtPriceX64Target, sqrtPriceX64Current, liquidity, true)
            : getTokenAmountBFromLiquidity(sqrtPriceX64Current, sqrtPriceX64Target, liquidity, true)
        if (amountRemainingSubtractFee.gte(swapStep.amountIn)) {
            swapStep.sqrtPriceX64Next = sqrtPriceX64Target
        } else {
            swapStep.sqrtPriceX64Next = getNextSqrtPriceX64FromInput(
                sqrtPriceX64Current,
                liquidity,
                amountRemainingSubtractFee,
                zeroForOne,
            )
        }
    } else {
        swapStep.amountOut = zeroForOne
            ? getTokenAmountBFromLiquidity(sqrtPriceX64Target, sqrtPriceX64Current, liquidity, false)
            : getTokenAmountAFromLiquidity(sqrtPriceX64Current, sqrtPriceX64Target, liquidity, false)
        if (amountRemaining.mul(new BN(-1)).gte(swapStep.amountOut)) {
            swapStep.sqrtPriceX64Next = sqrtPriceX64Target
        } else {
            swapStep.sqrtPriceX64Next = getNextSqrtPriceX64FromOutput(
                sqrtPriceX64Current,
                liquidity,
                amountRemaining.mul(new BN(-1)),
                zeroForOne,
            )
        }
    }

    const reachTargetPrice = sqrtPriceX64Target.eq(swapStep.sqrtPriceX64Next)

    if (zeroForOne) {
        if (!(reachTargetPrice && baseInput)) {
            swapStep.amountIn = getTokenAmountAFromLiquidity(
                swapStep.sqrtPriceX64Next,
                sqrtPriceX64Current,
                liquidity,
                true,
            )
        }

        if (!(reachTargetPrice && !baseInput)) {
            swapStep.amountOut = getTokenAmountBFromLiquidity(
                swapStep.sqrtPriceX64Next,
                sqrtPriceX64Current,
                liquidity,
                false,
            )
        }
    } else {
        swapStep.amountIn =
            reachTargetPrice && baseInput
                ? swapStep.amountIn
                : getTokenAmountBFromLiquidity(sqrtPriceX64Current, swapStep.sqrtPriceX64Next, liquidity, true)
        swapStep.amountOut =
            reachTargetPrice && !baseInput
                ? swapStep.amountOut
                : getTokenAmountAFromLiquidity(sqrtPriceX64Current, swapStep.sqrtPriceX64Next, liquidity, false)
    }

    if (!baseInput && swapStep.amountOut.gt(amountRemaining.mul(new BN(-1)))) {
        swapStep.amountOut = amountRemaining.mul(new BN(-1))
    }
    if (baseInput && !swapStep.sqrtPriceX64Next.eq(sqrtPriceX64Target)) {
        swapStep.feeAmount = amountRemaining.sub(swapStep.amountIn)
    } else {
        swapStep.feeAmount = mulDivCeil(
            swapStep.amountIn,
            new BN(feeRate),
            FEE_RATE_DENOMINATOR.sub(new BN(feeRate)),
        )
    }
    return [swapStep.sqrtPriceX64Next, swapStep.amountIn, swapStep.amountOut, swapStep.feeAmount]
}