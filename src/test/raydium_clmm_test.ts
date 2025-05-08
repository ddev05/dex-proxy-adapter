import { Connection, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { DEVNET_RPC, MAINNET_RPC, payer } from "../config";
import { parsePoolInfo, parseTickArrayBitmapExtension } from "../adapter/raydium-clmm/src/parse";
import { RaydiumClmmAdapter } from "../adapter";
import { getInitializedTickArrayInRange, getTickArrayStartIndexByTick } from "../adapter/raydium-clmm/src/utils/utils";
import { BN } from "bn.js";
import { getPdaExBitmapAccount, getPdaTickArrayAddress } from "../adapter/raydium-clmm/src/utils/pda";
import { RAYDIUM_CLMM_DEVNET_ADDR, RAYDIUM_CLMM_MAINNET_ADDR } from "../adapter/raydium-clmm/src";

const raydiumClmmSwapParam = {
    mainnet: {
        poolId: "B4Vwozy1FGtp8SELXSXydWSzavPUGnJ77DURV2k4MhUV",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv",
        inputAmount: 10 * LAMPORTS_PER_SOL,
        slippage: 0
    },
    devnet: {
        poolId: "99vDLcFwPCFFAusmBNkG8qo8zMxka8hrjp3iPR14BDsb",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "AMww6tqcaPUq4bVn1W7hKLQmNAe56d1yRFSKtV687uai",
        inputAmount: 0.00001 * LAMPORTS_PER_SOL,
        slippage: 0
    },
    localnet: {
        poolId: "B4Vwozy1FGtp8SELXSXydWSzavPUGnJ77DURV2k4MhUV",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv",
        inputAmount: 0.01 * LAMPORTS_PER_SOL,
        slippage: 0
    },
}


const raydiumClmmSwapParamTest = async () => {

    const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } = raydiumClmmSwapParam.mainnet

    const connection = new Connection(MAINNET_RPC, "processed")

    const rayClmmAdapter = await RaydiumClmmAdapter.create(connection, poolId, "mainnet")

    const poolInfo = rayClmmAdapter.getPoolKeys()

    console.log(poolInfo);

    // Get the exBitmap address
    const [exBitmapAddress] = getPdaExBitmapAccount(
        RAYDIUM_CLMM_MAINNET_ADDR,
        new PublicKey(poolId),
    );

    console.log(exBitmapAddress);

    const exBitmapInfo = await connection.getAccountInfo(exBitmapAddress)

    if (!exBitmapInfo) return

    const exBitmapInfoData = parseTickArrayBitmapExtension(exBitmapInfo.data)

    console.log(exBitmapInfoData);
    


    if (!poolInfo?.tickCurrent || !poolInfo?.tickSpacing) return

    const currentTickArrayStartIndex = getTickArrayStartIndexByTick(poolInfo?.tickCurrent, poolInfo?.tickSpacing)

    console.log(currentTickArrayStartIndex);

    const startIndexArray = getInitializedTickArrayInRange(
        poolInfo.tickArrayBitmap.map(ele => new BN(ele.toString())),
        exBitmapInfoData,
        poolInfo.tickSpacing,
        currentTickArrayStartIndex,
        7
    )

    const tickArraysToPoolId: Record<string, string> = {};

    const tickArrays = startIndexArray.map(itemIndex => {
        const [tickArrayAddress] = getPdaTickArrayAddress(
            RAYDIUM_CLMM_MAINNET_ADDR,
            new PublicKey(poolId),
            itemIndex,
        );

        tickArraysToPoolId[tickArrayAddress.toString()] = poolId;

        return { pubkey: tickArrayAddress };
    });

    console.log(tickArraysToPoolId);

}

raydiumClmmSwapParamTest()