import { Connection, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { DEVNET_RPC, MAINNET_RPC, payer } from "../config";
import { PumpfunAdapter } from "../adapter";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync } from "@solana/spl-token";

const pumpFunParam = {
    mainnet: {
        poolId: "14mXzvRcSc6sLALhyk7wwJYhF9J7fTJLVC2oE31fz7GN",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "Cf3DM7Fm8L6rZfwxmnvAguJYc499qU6SuEgsx638pump",
        inputAmount: 10000000,
        // inputAmount: 0.000001 * LAMPORTS_PER_SOL,
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
        poolId: "14mXzvRcSc6sLALhyk7wwJYhF9J7fTJLVC2oE31fz7GN",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "Cf3DM7Fm8L6rZfwxmnvAguJYc499qU6SuEgsx638pump",
        inputAmount: 0.01 * LAMPORTS_PER_SOL,
        slippage: 0
    },
}


const pumpFunTest = async () => {

    const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } = pumpFunParam.mainnet

    const connection = new Connection(MAINNET_RPC, "processed")
    const pumpfunAdaptor = await PumpfunAdapter.create(connection, outPutMintAddr, "mainnet")

    const poolInfo = pumpfunAdaptor.getPoolKeys()
    console.log(poolInfo);

    const reserve = await pumpfunAdaptor.getPoolReserves()
    console.log(reserve);

    const price = await pumpfunAdaptor.getPrice(reserve)
    console.log(price);

    const minQuoteAmount = pumpfunAdaptor.getSwapQuote(inputAmount, outPutMintAddr, reserve, 0.0)

    // const getSwapKeys = await PumpfunAdapter.getPoolsFromCa(connection, new PublicKey(outPutMintAddr), payer.publicKey)
    // console.log("Here is swap keys : ", getSwapKeys);


    const ata = getAssociatedTokenAddressSync(new PublicKey(inputAmount), payer.publicKey)
    const ataIx = createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, payer.publicKey, new PublicKey(outPutMintAddr))

    console.log("minQuoteAmount ", minQuoteAmount);

    const tx = new Transaction()

    const ix = await pumpfunAdaptor.getSwapInstruction(inputAmount, minQuoteAmount, {
        inputMint: new PublicKey(outPutMintAddr),
        payer: payer.publicKey
    })

    // tx.add(ataIx)
    tx.add(ix)

    tx.feePayer = payer.publicKey

    console.log(await connection.simulateTransaction(tx));

    const sig = await sendAndConfirmTransaction(connection, tx, [payer])

    console.log(sig);
}

pumpFunTest()