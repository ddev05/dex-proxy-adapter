import { PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { payer } from "../config";
import { PumpfunAdapter } from "../adapter";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddress, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { connection } from "@/config/web3";



const pumpFunTest = async () => {

    const mintAddress = "Cf3DM7Fm8L6rZfwxmnvAguJYc499qU6SuEgsx638pump";
    const inputAmount = 10000

    const pumpfunAdaptor = await PumpfunAdapter.create(connection, mintAddress)

    const poolInfo = pumpfunAdaptor.getPoolKeys()
    console.log(poolInfo);

    const reserve = await pumpfunAdaptor.getPoolReserves()
    console.log(reserve);

    const price = await pumpfunAdaptor.getPrice()
    console.log(price);

    const minQuoteAmount = pumpfunAdaptor.getSwapQuote(inputAmount, mintAddress, 0.0)

    // const getSwapKeys = await PumpfunAdapter.getPoolsFromCa(connection, new PublicKey(mintAddress), payer.publicKey)
    // console.log("Here is swap keys : ", getSwapKeys);


    const ata = getAssociatedTokenAddressSync(new PublicKey(inputAmount), payer.publicKey)
    const ataIx = createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, payer.publicKey, new PublicKey(mintAddress))

    console.log("minQuoteAmount ", minQuoteAmount);

    const tx = new Transaction()

    const ix = await pumpfunAdaptor.getSwapInstruction(inputAmount, minQuoteAmount, {
        inputMint: new PublicKey(mintAddress),
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