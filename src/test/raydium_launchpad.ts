import { Connection, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { DEVNET_RPC, MAINNET_RPC, payer } from "../config";
import { parseGlobalConfigAccount, parsePlatformConfigAccount, parsePoolStateAccount } from "../adapter/raydium-launchpad/src";
import { RaydiumLaunchlabAdapter } from "../adapter/raydium-launchpad";
import { createAssociatedTokenAccount, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync } from "@solana/spl-token";

const raydiumLaunchPadParam = {
    mainnet: {
        poolId: "9pycax4NJg4RmuHB9NT9ZKAJ3mEsnqLEbPrKGS1whfxG",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "2GukS36zyoR7ZMyHdRD3F1T4y5xYU1N953YnNmuEBray",
        inputAmount: 0.00001 * LAMPORTS_PER_SOL,
        slippage: 0
    },
    devnet: {
        poolId: "E1jS21jo1yuXaKHkD8qzAxcxD1a5w5LTHJRghzQH8vV7",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "6RHcynG6VNXZvHkSVgL9XoWW1EmjAz1U3Hvu6JBKDwZH",
        inputAmount: 0.00001 * LAMPORTS_PER_SOL,
        slippage: 0
    },
    localnet: {
        poolId: "9pycax4NJg4RmuHB9NT9ZKAJ3mEsnqLEbPrKGS1whfxG",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "2GukS36zyoR7ZMyHdRD3F1T4y5xYU1N953YnNmuEBray",
        inputAmount: 0.01 * LAMPORTS_PER_SOL,
        slippage: 0
    },
}

const raydiumLaunchPadParamTest = async () => {

    const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } = raydiumLaunchPadParam.mainnet

    const connection = new Connection(MAINNET_RPC, "processed")

    const rayLaunchAdapter = await RaydiumLaunchlabAdapter.create(connection, poolId)


    const poolKeys = rayLaunchAdapter.getPoolKeys()
    console.log("poolKeys ", poolKeys)
    const poolReserves = await rayLaunchAdapter.getPoolReserves()
    console.log("poolReserves ", poolReserves)
    const price = await rayLaunchAdapter.getPrice()
    console.log("price ", price)

    const minQuoteAmount = rayLaunchAdapter.getSwapQuote(inputAmount, outPutMintAddr, null, 0.0)

    console.log("minQuoteAmount , ", minQuoteAmount);
    const ata = getAssociatedTokenAddressSync(new PublicKey(outPutMintAddr), payer.publicKey)

    const createAta = createAssociatedTokenAccountInstruction(payer.publicKey, ata, payer.publicKey, new PublicKey(outPutMintAddr))
    const tx = new Transaction()

    const ix = rayLaunchAdapter.getSwapInstruction(inputAmount, Math.floor(minQuoteAmount), {
        inputMint: new PublicKey(outPutMintAddr),
        payer: payer.publicKey
    })

    // tx.add(createAta)
    tx.add(ix)

    tx.feePayer = payer.publicKey

    console.log(await connection.simulateTransaction(tx));

    const sig = await sendAndConfirmTransaction(connection, tx, [payer])

    console.log(sig);

}

raydiumLaunchPadParamTest()