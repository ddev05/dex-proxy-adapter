import { Connection, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { DEVNET_RPC, payer } from "../config";
import { RAYDIUM_V4_DEVNET_PROGRAM } from "../adapter/raydium-amm/src";
import { RaydiumV4Adapter } from "../adapter";

const raydiumV4SwapParam = {
    mainnet: {
        poolId: "AB1eu2L1Jr3nfEft85AuD2zGksUbam1Kr8MR3uM2sjwt",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump",
        inputAmount: 10 * LAMPORTS_PER_SOL,
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
        poolId: "AB1eu2L1Jr3nfEft85AuD2zGksUbam1Kr8MR3uM2sjwt",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump",
        inputAmount: 0.01 * LAMPORTS_PER_SOL,
        slippage: 0
    },
}


const raydiumV4SwapParamTest = async () => {

    const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } = raydiumV4SwapParam.devnet

    const connection = new Connection(DEVNET_RPC, "processed")
    const rayV4Adapter = await RaydiumV4Adapter.create(connection, poolId, "devnet")

    const poolInfo = rayV4Adapter.getPoolKeys()
    console.log(poolInfo);

    if (!poolInfo?.baseVault || !poolInfo?.quoteVault || !poolInfo.baseMint || !poolInfo.quoteMint) return

    const reserve = await rayV4Adapter.getPoolReserves()
    console.log(reserve);

    const price = await rayV4Adapter.getPrice(reserve)
    console.log(price);

    const minQuoteAmount = rayV4Adapter.getSwapQuote(inputAmount, inputMintAddr, reserve, 0.0)

    console.log(minQuoteAmount);

    const tx = new Transaction()

    const ix = rayV4Adapter.getSwapInstruction(inputAmount, minQuoteAmount, {
        amm: new PublicKey(poolId),
        ammCoinVault: poolInfo.baseVault,
        ammPcVault: poolInfo.quoteVault,
        ammProgram: RAYDIUM_V4_DEVNET_PROGRAM,
        inputMint: new PublicKey(inputMintAddr),
        userSourceOwner: payer.publicKey
    })

    tx.add(ix)

    tx.feePayer = payer.publicKey

    console.log(await connection.simulateTransaction(tx));

    const sig = await sendAndConfirmTransaction(connection, tx, [payer])

    console.log(sig);

}

raydiumV4SwapParamTest()