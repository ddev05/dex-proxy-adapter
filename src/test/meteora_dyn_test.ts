import { Connection, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { DEVNET_RPC, MAINNET_RPC, payer } from "../config";
import { parsePoolAccount } from "../adapter/meteora-dyn/src/parse";

const pumpFunParam = {
    mainnet: {
        poolId: "B1AdQ85N2mJ2xtMg9bgThhsPoA6T3M26rt4TChWSiPpr",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "3iQL8BFS2vE7mww4ehAqQHAsbmRNCrPxizWAT2Zfyr9y",
        inputAmount: 0.000001 * LAMPORTS_PER_SOL,
        slippage: 0
    },
    devnet: {
        poolId: "H2QbwERVNPPWX568MLdbEqE1wfdEijX8jUYAbKDKtw4X",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "9eY4FKSmPvYVq5WPUvjcuX8cpDLzMGbgUfPxnxQ8UjzP",
        inputAmount: 1 * LAMPORTS_PER_SOL,
        slippage: 0
    },
    localnet: {
        poolId: "B1AdQ85N2mJ2xtMg9bgThhsPoA6T3M26rt4TChWSiPpr",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "3iQL8BFS2vE7mww4ehAqQHAsbmRNCrPxizWAT2Zfyr9y",
        inputAmount: 0.01 * LAMPORTS_PER_SOL,
        slippage: 0
    },
}


const meteoraDynTest = async () => {

    const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } = pumpFunParam.mainnet

    const connection = new Connection(MAINNET_RPC, "processed")

    const data = await connection.getAccountInfo(new PublicKey(poolId))

    if (!data) {
        return
    }

    const praseData = parsePoolAccount(data?.data)

    console.log(JSON.stringify(praseData , null , 2));
}

meteoraDynTest()