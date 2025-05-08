import BN from "bn.js"
import { TICK_ARRAY_SIZE } from "../constants"
import { TickArrayBitmapExtensionType } from "../types"


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