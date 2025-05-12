import BN from "bn.js"
import { MAX_TICK, MIN_TICK, TICK_ARRAY_BITMAP_SIZE, TICK_ARRAY_SIZE } from "../constants"
import { TickArray, TickArrayBitmapExtensionType } from "../types"
import { isZero, leadingZeros, leastSignificantBit, mostSignificantBit, trailingZeros } from "./math"


const getTickArrayBitIndex = (tickIndex: number, tickSpacing: number) => {
    const ticksInArray = tickCount(tickSpacing)

    let startIndex: number = tickIndex / ticksInArray
    if (tickIndex < 0 && tickIndex % ticksInArray != 0) {
        startIndex = Math.ceil(startIndex) - 1
    } else {
        startIndex = Math.floor(startIndex)
    }
    return startIndex
}

const tickCount = (tickSpacing: number): number => {
    return TICK_ARRAY_SIZE * tickSpacing
}

const mergeTickArrayBitmap = (bns: BN[]) => {
    let b = new BN(0)
    for (let i = 0; i < bns.length; i++) {
        b = b.add(bns[i].shln(64 * i))
    }
    return b
    // return bns[0]
    //   .add(bns[1].shln(64))
    //   .add(bns[2].shln(128))
    //   .add(bns[3].shln(192))
    //   .add(bns[4].shln(256))
    //   .add(bns[5].shln(320))
    //   .add(bns[6].shln(384))
    //   .add(bns[7].shln(448))
    //   .add(bns[8].shln(512))
    //   .add(bns[9].shln(576))
    //   .add(bns[10].shln(640))
    //   .add(bns[11].shln(704))
    //   .add(bns[12].shln(768))
    //   .add(bns[13].shln(832))
    //   .add(bns[14].shln(896))
    //   .add(bns[15].shln(960))
}

const searchLowBitFromStart = (
    tickArrayBitmap: BN[],
    exTickArrayBitmap: TickArrayBitmapExtensionType,
    currentTickArrayBitStartIndex: number,
    expectedCount: number,
    tickSpacing: number,
) => {
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

    const returnTickCount = tickCount(tickSpacing)
    return result.map((i) => i * returnTickCount)
}

const searchHightBitFromStart = (
    tickArrayBitmap: BN[],
    exTickArrayBitmap: TickArrayBitmapExtensionType,
    currentTickArrayBitStartIndex: number,
    expectedCount: number,
    tickSpacing: number,
) => {
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

    const returnTickCount = tickCount(tickSpacing)
    return result.map((i) => i * returnTickCount)
}

export const tickRange = (tickSpacing: number): {
    maxTickBoundary: number
    minTickBoundary: number
} => {
    let maxTickBoundary = tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE
    let minTickBoundary = -maxTickBoundary

    if (maxTickBoundary > MAX_TICK) {
        maxTickBoundary = MAX_TICK
    }
    if (minTickBoundary < MIN_TICK) {
        minTickBoundary = MIN_TICK
    }
    return { maxTickBoundary, minTickBoundary }
}


const getBitmapTickBoundary = (
    tickarrayStartIndex: number,
    tickSpacing: number,
): {
    minValue: number
    maxValue: number
} => {
    const ticksInOneBitmap = tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE
    let m = Math.floor(Math.abs(tickarrayStartIndex) / ticksInOneBitmap)
    if (tickarrayStartIndex < 0 && Math.abs(tickarrayStartIndex) % ticksInOneBitmap != 0) m += 1

    const minValue = ticksInOneBitmap * m

    return tickarrayStartIndex < 0
        ? { minValue: -minValue, maxValue: -minValue + ticksInOneBitmap }
        : { minValue, maxValue: minValue + ticksInOneBitmap }
}


const nextInitializedTickArrayInBitmap = (
    tickarrayBitmap: BN[],
    nextTickArrayStartIndex: number,
    tickSpacing: number,
    zeroForOne: boolean,
) => {
    const { minValue: bitmapMinTickBoundary, maxValue: bitmapMaxTickBoundary } = getBitmapTickBoundary(
        nextTickArrayStartIndex,
        tickSpacing,
    )

    const tickArrayOffsetInBitmapData = tickArrayOffsetInBitmap(nextTickArrayStartIndex, tickSpacing)
    if (zeroForOne) {
        // tick from upper to lower
        // find from highter bits to lower bits
        const offsetBitMap = mergeTickArrayBitmap(tickarrayBitmap).shln(
            TICK_ARRAY_BITMAP_SIZE - 1 - tickArrayOffsetInBitmapData,
        )

        const nextBit = isZero(512, offsetBitMap) ? null : leadingZeros(512, offsetBitMap)

        if (nextBit !== null) {
            const nextArrayStartIndex = nextTickArrayStartIndex - nextBit * tickCount(tickSpacing)
            return { isInit: true, tickIndex: nextArrayStartIndex }
        } else {
            // not found til to the end
            return { isInit: false, tickIndex: bitmapMinTickBoundary }
        }
    } else {
        // tick from lower to upper
        // find from lower bits to highter bits
        const offsetBitMap = mergeTickArrayBitmap(tickarrayBitmap).shrn(tickArrayOffsetInBitmapData)

        const nextBit = isZero(512, offsetBitMap) ? null : trailingZeros(512, offsetBitMap)

        if (nextBit !== null) {
            const nextArrayStartIndex = nextTickArrayStartIndex + nextBit * tickCount(tickSpacing)
            return { isInit: true, tickIndex: nextArrayStartIndex }
        } else {
            // not found til to the end
            return { isInit: false, tickIndex: bitmapMaxTickBoundary - tickCount(tickSpacing) }
        }
    }
}

const nextInitializedTickArrayFromOneBitmap = (
    lastTickArrayStartIndex: number,
    tickSpacing: number,
    zeroForOne: boolean,
    tickArrayBitmapExtension: TickArrayBitmapExtensionType,
) => {
    const multiplier = tickCount(tickSpacing)
    const nextTickArrayStartIndex = zeroForOne
        ? lastTickArrayStartIndex - multiplier
        : lastTickArrayStartIndex + multiplier

    const minTickArrayStartIndex = getArrayStartIndex(MIN_TICK, tickSpacing)
    const maxTickArrayStartIndex = getArrayStartIndex(MAX_TICK, tickSpacing)

    if (nextTickArrayStartIndex < minTickArrayStartIndex || nextTickArrayStartIndex > maxTickArrayStartIndex) {
        return {
            isInit: false,
            tickIndex: nextTickArrayStartIndex,
        }
    }

    const { tickarrayBitmap } = getBitmap(nextTickArrayStartIndex, tickSpacing, tickArrayBitmapExtension)

    return nextInitializedTickArrayInBitmap(tickarrayBitmap, nextTickArrayStartIndex, tickSpacing, zeroForOne)
}

const nextInitializedTickArrayStartIndex = (
    bitMap: BN,
    lastTickArrayStartIndex: number,
    tickSpacing: number,
    zeroForOne: boolean,
) => {
    if (!checkIsValidStartIndex(lastTickArrayStartIndex, tickSpacing))
        throw Error('nextInitializedTickArrayStartIndex check error')

    const tickBoundary = tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE
    const nextTickArrayStartIndex = zeroForOne
        ? lastTickArrayStartIndex - tickCount(tickSpacing)
        : lastTickArrayStartIndex + tickCount(tickSpacing)

    if (nextTickArrayStartIndex < -tickBoundary || nextTickArrayStartIndex >= tickBoundary) {
        return { isInit: false, tickIndex: lastTickArrayStartIndex }
    }

    const multiplier = tickSpacing * TICK_ARRAY_SIZE
    let compressed = nextTickArrayStartIndex / multiplier + 512

    if (nextTickArrayStartIndex < 0 && nextTickArrayStartIndex % multiplier != 0) {
        compressed--
    }

    const bitPos = Math.abs(compressed)

    if (zeroForOne) {
        const offsetBitMap = bitMap.shln(1024 - bitPos - 1)
        const nextBit = mostSignificantBit(1024, offsetBitMap)
        if (nextBit !== null) {
            const nextArrayStartIndex = (bitPos - nextBit - 512) * multiplier
            return { isInit: true, tickIndex: nextArrayStartIndex }
        } else {
            return { isInit: false, tickIndex: -tickBoundary }
        }
    } else {
        const offsetBitMap = bitMap.shrn(bitPos)
        const nextBit = leastSignificantBit(1024, offsetBitMap)
        if (nextBit !== null) {
            const nextArrayStartIndex = (bitPos + nextBit - 512) * multiplier
            return { isInit: true, tickIndex: nextArrayStartIndex }
        } else {
            return { isInit: false, tickIndex: tickBoundary - tickCount(tickSpacing) }
        }
    }
}

export const nextInitializedTickArrayStartIndexPoolUtils = (
    poolInfo:
        | {
            tickCurrent: number
            tickSpacing: number
            tickArrayBitmap: BN[]
            exBitmapInfo: TickArrayBitmapExtensionType
        },
    lastTickArrayStartIndex: number,
    zeroForOne: boolean,
) => {
    lastTickArrayStartIndex = getArrayStartIndex(lastTickArrayStartIndex, poolInfo.tickSpacing)

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const { isInit: startIsInit, tickIndex: startIndex } = nextInitializedTickArrayStartIndex(
            mergeTickArrayBitmap(poolInfo.tickArrayBitmap),
            lastTickArrayStartIndex,
            poolInfo.tickSpacing,
            zeroForOne,
        )
        if (startIsInit) {
            return { isExist: true, nextStartIndex: startIndex }
        }
        lastTickArrayStartIndex = startIndex

        const { isInit, tickIndex } = nextInitializedTickArrayFromOneBitmap(
            lastTickArrayStartIndex,
            poolInfo.tickSpacing,
            zeroForOne,
            poolInfo.exBitmapInfo,
        )
        if (isInit) return { isExist: true, nextStartIndex: tickIndex }

        lastTickArrayStartIndex = tickIndex

        if (lastTickArrayStartIndex < MIN_TICK || lastTickArrayStartIndex > MAX_TICK)
            return { isExist: false, nextStartIndex: 0 }
    }
}

export const checkTickArrayIsInitialized = (bitmap: BN, tick: number, tickSpacing: number) => {
    const multiplier = tickSpacing * TICK_ARRAY_SIZE
    const compressed = Math.floor(tick / multiplier) + 512
    const bitPos = Math.abs(compressed)
    return {
        isInitialized: bitmap.testn(bitPos),
        startIndex: (bitPos - 512) * multiplier,
    }
}

const tickArrayOffsetInBitmap = (tickArrayStartIndex: number, tickSpacing: number): number => {
    const m = Math.abs(tickArrayStartIndex) % (tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE)
    let tickArrayOffsetInBitmap = Math.floor(m / tickCount(tickSpacing))
    if (tickArrayStartIndex < 0 && m != 0) {
        tickArrayOffsetInBitmap = TICK_ARRAY_BITMAP_SIZE - tickArrayOffsetInBitmap
    }
    return tickArrayOffsetInBitmap
}

const checkIsOutOfBoundary = (tick: number): boolean => {
    return tick < MIN_TICK || tick > MAX_TICK
}

const checkIsValidStartIndex = (tickIndex: number, tickSpacing: number): boolean => {
    if (checkIsOutOfBoundary(tickIndex)) {
        if (tickIndex > MAX_TICK) {
            return false
        }
        const minStartIndex = getTickArrayStartIndexByTick(MIN_TICK, tickSpacing)
        return tickIndex == minStartIndex
    }
    return tickIndex % tickCount(tickSpacing) == 0
}


const extensionTickBoundary = (tickSpacing: number): {
    positiveTickBoundary: number
    negativeTickBoundary: number
} => {
    const positiveTickBoundary = tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE

    const negativeTickBoundary = -positiveTickBoundary

    if (MAX_TICK <= positiveTickBoundary)
        throw Error(`extensionTickBoundary check error: ${MAX_TICK}, ${positiveTickBoundary}`)
    if (negativeTickBoundary <= MIN_TICK)
        throw Error(`extensionTickBoundary check error: ${negativeTickBoundary}, ${MIN_TICK}`)

    return { positiveTickBoundary, negativeTickBoundary }
}


const checkExtensionBoundary = (tickIndex: number, tickSpacing: number) => {
    const { positiveTickBoundary, negativeTickBoundary } = extensionTickBoundary(tickSpacing)

    if (tickIndex >= negativeTickBoundary && tickIndex < positiveTickBoundary) {
        throw Error('checkExtensionBoundary -> InvalidTickArrayBoundary')
    }
}

const getBitmapOffset = (tickIndex: number, tickSpacing: number): number => {
    if (!checkIsValidStartIndex(tickIndex, tickSpacing)) {
        throw new Error('No enough initialized tickArray')
    }
    checkExtensionBoundary(tickIndex, tickSpacing)

    const ticksInOneBitmap = tickSpacing * TICK_ARRAY_SIZE * TICK_ARRAY_BITMAP_SIZE
    let offset = Math.floor(Math.abs(tickIndex) / ticksInOneBitmap) - 1

    if (tickIndex < 0 && Math.abs(tickIndex) % ticksInOneBitmap === 0) offset--
    return offset
}

const getBitmap = (
    tickIndex: number,
    tickSpacing: number,
    tickArrayBitmapExtension: TickArrayBitmapExtensionType,
): { offset: number; tickarrayBitmap: BN[] } => {
    const offset = getBitmapOffset(tickIndex, tickSpacing)
    if (tickIndex < 0) {
        return { offset, tickarrayBitmap: tickArrayBitmapExtension.negativeTickArrayBitmap[offset] }
    } else {
        return { offset, tickarrayBitmap: tickArrayBitmapExtension.positiveTickArrayBitmap[offset] }
    }
}

export const checkTickArrayIsInit = (
    tickArrayStartIndex: number,
    tickSpacing: number,
    tickArrayBitmapExtension: TickArrayBitmapExtensionType,
) => {
    const { tickarrayBitmap } = getBitmap(tickArrayStartIndex, tickSpacing, tickArrayBitmapExtension)

    const tickArrayOffsetInBitmapOutPut = tickArrayOffsetInBitmap(tickArrayStartIndex, tickSpacing)

    return {
        isInitialized: mergeTickArrayBitmap(tickarrayBitmap).testn(tickArrayOffsetInBitmapOutPut),
        startIndex: tickArrayStartIndex,
    }
}

export const getArrayStartIndex = (tickIndex: number, tickSpacing: number) => {
    const ticksInArray = tickCount(tickSpacing)
    const start = Math.floor(tickIndex / ticksInArray)

    return start * ticksInArray
}

export const isOverflowDefaultTickarrayBitmap = (tickSpacing: number, tickarrayStartIndexs: number[]): boolean => {
    const { maxTickBoundary, minTickBoundary } = tickRange(tickSpacing)

    for (const tickIndex of tickarrayStartIndexs) {
        const tickarrayStartIndex = getTickArrayStartIndexByTick(tickIndex, tickSpacing)

        if (tickarrayStartIndex >= maxTickBoundary || tickarrayStartIndex < minTickBoundary) {
            return true
        }
    }

    return false
}

export const getTickArrayStartIndexByTick = (tickIndex: number, tickSpacing: number) => {
    return getTickArrayBitIndex(tickIndex, tickSpacing) * tickCount(tickSpacing)
}

export const getInitializedTickArrayInRange = (
    tickArrayBitmap: BN[],
    exTickArrayBitmap: TickArrayBitmapExtensionType,
    tickSpacing: number,
    tickArrayStartIndex: number,
    expectedCount: number,
) => {
    const tickArrayOffset = Math.floor(tickArrayStartIndex / (tickSpacing * TICK_ARRAY_SIZE))
    return [
        // find right of currenct offset
        ...searchLowBitFromStart(
            tickArrayBitmap,
            exTickArrayBitmap,
            tickArrayOffset - 1,
            expectedCount,
            tickSpacing,
        ),

        // find left of current offset
        ...searchHightBitFromStart(
            tickArrayBitmap,
            exTickArrayBitmap,
            tickArrayOffset,
            expectedCount,
            tickSpacing,
        ),
    ]
}

export function nextInitTick(
    tickArrayCurrent: TickArray,
    currentTickIndex: number,
    tickSpacing: number,
    zeroForOne: boolean,
    t: boolean,
) {
    const currentTickArrayStartIndex = getArrayStartIndex(currentTickIndex, tickSpacing)
    if (currentTickArrayStartIndex != tickArrayCurrent.startTickIndex) {
        return null
    }
    let offsetInArray = Math.floor((currentTickIndex - tickArrayCurrent.startTickIndex) / tickSpacing)

    if (zeroForOne) {
        while (offsetInArray >= 0) {
            if (new BN(tickArrayCurrent.ticks[offsetInArray].liquidityGross.toString()).gtn(0)) {
                return tickArrayCurrent.ticks[offsetInArray]
            }
            offsetInArray = offsetInArray - 1
        }
    } else {
        if (!t) offsetInArray = offsetInArray + 1
        while (offsetInArray < TICK_ARRAY_SIZE) {
            if (new BN(tickArrayCurrent.ticks[offsetInArray].liquidityGross.toString()).gtn(0)) {
                return tickArrayCurrent.ticks[offsetInArray]
            }
            offsetInArray = offsetInArray + 1
        }
    }
    return null
}
