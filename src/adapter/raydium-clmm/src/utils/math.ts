import BN from "bn.js"
import {
    BIT_PRECISION,
    LOG_B_2_X32,
    LOG_B_P_ERR_MARGIN_LOWER_X64,
    LOG_B_P_ERR_MARGIN_UPPER_X64,
    MAX_SQRT_PRICE_X64,
    MAX_TICK,
    MaxUint128,
    MIN_SQRT_PRICE_X64,
    MIN_TICK,
    Q64,
    U64Resolution
} from "../constants"
import Decimal from "decimal.js";

export function isZero(bitNum: number, data: BN) {
    for (let i = 0; i < bitNum; i++) {
        if (data.testn(i)) return false
    }
    return true
}

export function leadingZeros(bitNum: number, data: BN) {
    let i = 0
    for (let j = bitNum - 1; j >= 0; j--) {
        if (!data.testn(j)) {
            i++
        } else {
            break
        }
    }
    return i
}

export function trailingZeros(bitNum: number, data: BN) {
    let i = 0
    for (let j = 0; j < bitNum; j++) {
        if (!data.testn(j)) {
            i++
        } else {
            break
        }
    }
    return i
}

export function mostSignificantBit(bitNum: number, data: BN) {
    if (isZero(bitNum, data)) return null
    else return leadingZeros(bitNum, data)
}

export function leastSignificantBit(bitNum: number, data: BN) {
    if (isZero(bitNum, data)) return null
    else return trailingZeros(bitNum, data)
}

export function addDelta(x: BN, y: BN): BN {
    return x.add(y)
}

function signedLeftShift(n0: BN, shiftBy: number, bitWidth: number) {
    const twosN0 = n0.toTwos(bitWidth).shln(shiftBy)
    twosN0.imaskn(bitWidth + 1)
    return twosN0.fromTwos(bitWidth)
}

function signedRightShift(n0: BN, shiftBy: number, bitWidth: number) {
    const twoN0 = n0.toTwos(bitWidth).shrn(shiftBy)
    twoN0.imaskn(bitWidth - shiftBy + 1)
    return twoN0.fromTwos(bitWidth - shiftBy)
}

function mulRightShift(val: BN, mulBy: BN): BN {
    return signedRightShift(val.mul(mulBy), 64, 256)
}

export function getTickFromSqrtPriceX64(sqrtPriceX64: BN): number {
    if (sqrtPriceX64.gt(MAX_SQRT_PRICE_X64) || sqrtPriceX64.lt(MIN_SQRT_PRICE_X64)) {
        throw new Error('Provided sqrtPrice is not within the supported sqrtPrice range.')
    }

    const msb = sqrtPriceX64.bitLength() - 1
    const adjustedMsb = new BN(msb - 64)
    const log2pIntegerX32 = signedLeftShift(adjustedMsb, 32, 128)

    let bit = new BN('8000000000000000', 'hex')
    let precision = 0
    let log2pFractionX64 = new BN(0)

    let r = msb >= 64 ? sqrtPriceX64.shrn(msb - 63) : sqrtPriceX64.shln(63 - msb)

    while (bit.gt(new BN(0)) && precision < BIT_PRECISION) {
        r = r.mul(r)
        const rMoreThanTwo = r.shrn(127)
        r = r.shrn(63 + rMoreThanTwo.toNumber())
        log2pFractionX64 = log2pFractionX64.add(bit.mul(rMoreThanTwo))
        bit = bit.shrn(1)
        precision += 1
    }

    const log2pFractionX32 = log2pFractionX64.shrn(32)

    const log2pX32 = log2pIntegerX32.add(log2pFractionX32)
    const logbpX64 = log2pX32.mul(new BN(LOG_B_2_X32))

    const tickLow = signedRightShift(logbpX64.sub(new BN(LOG_B_P_ERR_MARGIN_LOWER_X64)), 64, 128).toNumber()
    const tickHigh = signedRightShift(logbpX64.add(new BN(LOG_B_P_ERR_MARGIN_UPPER_X64)), 64, 128).toNumber()

    if (tickLow == tickHigh) {
        return tickLow
    } else {
        const derivedTickHighSqrtPriceX64 = getSqrtPriceX64FromTick(tickHigh)
        return derivedTickHighSqrtPriceX64.lte(sqrtPriceX64) ? tickHigh : tickLow
    }
}

export const getSqrtPriceX64FromTick = (tick: number): BN => {
    if (!Number.isInteger(tick)) {
        throw new Error('tick must be integer')
    }
    if (tick < MIN_TICK || tick > MAX_TICK) {
        throw new Error('tick must be in MIN_TICK and MAX_TICK')
    }
    const tickAbs: number = tick < 0 ? tick * -1 : tick

    let ratio: BN = (tickAbs & 0x1) != 0 ? new BN('18445821805675395072') : new BN('18446744073709551616')
    if ((tickAbs & 0x2) != 0) ratio = mulRightShift(ratio, new BN('18444899583751176192'))
    if ((tickAbs & 0x4) != 0) ratio = mulRightShift(ratio, new BN('18443055278223355904'))
    if ((tickAbs & 0x8) != 0) ratio = mulRightShift(ratio, new BN('18439367220385607680'))
    if ((tickAbs & 0x10) != 0) ratio = mulRightShift(ratio, new BN('18431993317065453568'))
    if ((tickAbs & 0x20) != 0) ratio = mulRightShift(ratio, new BN('18417254355718170624'))
    if ((tickAbs & 0x40) != 0) ratio = mulRightShift(ratio, new BN('18387811781193609216'))
    if ((tickAbs & 0x80) != 0) ratio = mulRightShift(ratio, new BN('18329067761203558400'))
    if ((tickAbs & 0x100) != 0) ratio = mulRightShift(ratio, new BN('18212142134806163456'))
    if ((tickAbs & 0x200) != 0) ratio = mulRightShift(ratio, new BN('17980523815641700352'))
    if ((tickAbs & 0x400) != 0) ratio = mulRightShift(ratio, new BN('17526086738831433728'))
    if ((tickAbs & 0x800) != 0) ratio = mulRightShift(ratio, new BN('16651378430235570176'))
    if ((tickAbs & 0x1000) != 0) ratio = mulRightShift(ratio, new BN('15030750278694412288'))
    if ((tickAbs & 0x2000) != 0) ratio = mulRightShift(ratio, new BN('12247334978884435968'))
    if ((tickAbs & 0x4000) != 0) ratio = mulRightShift(ratio, new BN('8131365268886854656'))
    if ((tickAbs & 0x8000) != 0) ratio = mulRightShift(ratio, new BN('3584323654725218816'))
    if ((tickAbs & 0x10000) != 0) ratio = mulRightShift(ratio, new BN('696457651848324352'))
    if ((tickAbs & 0x20000) != 0) ratio = mulRightShift(ratio, new BN('26294789957507116'))
    if ((tickAbs & 0x40000) != 0) ratio = mulRightShift(ratio, new BN('37481735321082'))

    if (tick > 0) ratio = MaxUint128.div(ratio)
    return ratio
}

function x64ToDecimal(num: BN, decimalPlaces?: number): Decimal {
    return new Decimal(num.toString()).div(Decimal.pow(2, 64)).toDecimalPlaces(decimalPlaces)
}

export function sqrtPriceX64ToPrice(sqrtPriceX64: BN, decimalsA: number, decimalsB: number): Decimal {
    return x64ToDecimal(sqrtPriceX64)
        .pow(2)
        .mul(Decimal.pow(10, decimalsA - decimalsB))
}


function mulDivRoundingUp(a: BN, b: BN, denominator: BN): BN {
    const numerator = a.mul(b)
    let result = numerator.div(denominator)
    if (!numerator.mod(denominator).eq(new BN(0))) {
        result = result.add(new BN(1))
    }
    return result
}

export function mulDivCeil(a: BN, b: BN, denominator: BN): BN {
    if (denominator.eq(new BN(0))) {
        throw new Error('division by 0')
    }
    const numerator = a.mul(b).add(denominator.sub(new BN(1)))
    return numerator.div(denominator)
}

export function mulDivFloor(a: BN, b: BN, denominator: BN): BN {
    if (denominator.eq(new BN(0))) {
        throw new Error('division by 0')
    }
    return a.mul(b).div(denominator)
}

export function getTokenAmountAFromLiquidity(
    sqrtPriceX64A: BN,
    sqrtPriceX64B: BN,
    liquidity: BN,
    roundUp: boolean,
): BN {
    if (sqrtPriceX64A.gt(sqrtPriceX64B)) {
        ;[sqrtPriceX64A, sqrtPriceX64B] = [sqrtPriceX64B, sqrtPriceX64A]
    }

    if (!sqrtPriceX64A.gt(new BN(0))) {
        throw new Error('sqrtPriceX64A must greater than 0')
    }

    const numerator1 = liquidity.ushln(U64Resolution)
    const numerator2 = sqrtPriceX64B.sub(sqrtPriceX64A)

    return roundUp
        ? mulDivRoundingUp(mulDivCeil(numerator1, numerator2, sqrtPriceX64B), new BN(1), sqrtPriceX64A)
        : mulDivFloor(numerator1, numerator2, sqrtPriceX64B).div(sqrtPriceX64A)
}


export function getTokenAmountBFromLiquidity(
    sqrtPriceX64A: BN,
    sqrtPriceX64B: BN,
    liquidity: BN,
    roundUp: boolean,
): BN {
    if (sqrtPriceX64A.gt(sqrtPriceX64B)) {
        ;[sqrtPriceX64A, sqrtPriceX64B] = [sqrtPriceX64B, sqrtPriceX64A]
    }
    if (!sqrtPriceX64A.gt(new BN(0))) {
        throw new Error('sqrtPriceX64A must greater than 0')
    }

    return roundUp
        ? mulDivCeil(liquidity, sqrtPriceX64B.sub(sqrtPriceX64A), Q64)
        : mulDivFloor(liquidity, sqrtPriceX64B.sub(sqrtPriceX64A), Q64)
}

function getNextSqrtPriceFromTokenAmountBRoundingDown(
    sqrtPriceX64: BN,
    liquidity: BN,
    amount: BN,
    add: boolean,
): BN {
    const deltaY = amount.shln(U64Resolution)
    if (add) {
        return sqrtPriceX64.add(deltaY.div(liquidity))
    } else {
        const amountDivLiquidity = mulDivRoundingUp(deltaY, new BN(1), liquidity)
        if (!sqrtPriceX64.gt(amountDivLiquidity)) {
            throw new Error('getNextSqrtPriceFromTokenAmountBRoundingDown sqrtPriceX64 must gt amountDivLiquidity')
        }
        return sqrtPriceX64.sub(amountDivLiquidity)
    }
}

export function getNextSqrtPriceFromTokenAmountARoundingUp(
    sqrtPriceX64: BN,
    liquidity: BN,
    amount: BN,
    add: boolean,
): BN {
    if (amount.eq(new BN(0))) return sqrtPriceX64
    const liquidityLeftShift = liquidity.shln(U64Resolution)

    if (add) {
        const numerator1 = liquidityLeftShift
        const denominator = liquidityLeftShift.add(amount.mul(sqrtPriceX64))
        if (denominator.gte(numerator1)) {
            return mulDivCeil(numerator1, sqrtPriceX64, denominator)
        }
        return mulDivRoundingUp(numerator1, new BN(1), numerator1.div(sqrtPriceX64).add(amount))
    } else {
        const amountMulSqrtPrice = amount.mul(sqrtPriceX64)
        if (!liquidityLeftShift.gt(amountMulSqrtPrice)) {
            throw new Error('getNextSqrtPriceFromTokenAmountARoundingUp,liquidityLeftShift must gt amountMulSqrtPrice')
        }
        const denominator = liquidityLeftShift.sub(amountMulSqrtPrice)
        return mulDivCeil(liquidityLeftShift, sqrtPriceX64, denominator)
    }
}

export function getNextSqrtPriceX64FromOutput(sqrtPriceX64: BN, liquidity: BN, amountOut: BN, zeroForOne: boolean): BN {
    if (!sqrtPriceX64.gt(new BN(0))) {
        throw new Error('sqrtPriceX64 must greater than 0')
    }
    if (!liquidity.gt(new BN(0))) {
        throw new Error('liquidity must greater than 0')
    }

    return zeroForOne
        ? getNextSqrtPriceFromTokenAmountBRoundingDown(sqrtPriceX64, liquidity, amountOut, false)
        : getNextSqrtPriceFromTokenAmountARoundingUp(sqrtPriceX64, liquidity, amountOut, false)
}

export function getNextSqrtPriceX64FromInput(sqrtPriceX64: BN, liquidity: BN, amountIn: BN, zeroForOne: boolean): BN {
    if (!sqrtPriceX64.gt(new BN(0))) {
        throw new Error('sqrtPriceX64 must greater than 0')
    }
    if (!liquidity.gt(new BN(0))) {
        throw new Error('liquidity must greater than 0')
    }

    return zeroForOne
        ? getNextSqrtPriceFromTokenAmountARoundingUp(sqrtPriceX64, liquidity, amountIn, true)
        : getNextSqrtPriceFromTokenAmountBRoundingDown(sqrtPriceX64, liquidity, amountIn, true)
}

function decimalToX64(num: Decimal): BN {
    return new BN(num.mul(Decimal.pow(2, 64)).floor().toFixed())
}
export function priceToSqrtPriceX64(price: Decimal, decimalsA: number, decimalsB: number): BN {
    return decimalToX64(price.mul(Decimal.pow(10, decimalsB - decimalsA)).sqrt())
}
