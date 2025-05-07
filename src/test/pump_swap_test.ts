import { Connection, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { DEVNET_RPC, payer } from "../config";
import { PumpSwapAdapter } from "../adapter";

const pumpAmmSwapParam = {
    mainnet: {
        poolId: "EA4xjkrKYy1XmQ9A63p4FS5bvGqPZjuDrSS8x1RNaegx",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "9jUb38tuMqsCe328tM7kxFEm3wRpbo3MbXPJoFiTpump",
        inputAmount: 10 * LAMPORTS_PER_SOL,
        slippage: 0
    },
    devnet: {
        poolId: "H2QbwERVNPPWX568MLdbEqE1wfdEijX8jUYAbKDKtw4X",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "9eY4FKSmPvYVq5WPUvjcuX8cpDLzMGbgUfPxnxQ8UjzP",
        inputAmount: 0.0001 * LAMPORTS_PER_SOL,
        slippage: 0
    },
    localnet: {
        poolId: "EA4xjkrKYy1XmQ9A63p4FS5bvGqPZjuDrSS8x1RNaegx",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "9jUb38tuMqsCe328tM7kxFEm3wRpbo3MbXPJoFiTpump",
        inputAmount: 0.01 * LAMPORTS_PER_SOL,
        slippage: 0
    },
}


const pumpSwapParamTest = async () => {

    const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } = pumpAmmSwapParam.devnet

    const connection = new Connection(DEVNET_RPC, "processed")
    const pumpSwapAdapter = await PumpSwapAdapter.create(connection, poolId, "devnet")

    const poolInfo = pumpSwapAdapter.getPoolKeys()
    console.log(poolInfo);

    if (!poolInfo?.pool_base_token_account || !poolInfo?.quote_mint || !poolInfo.base_mint || !poolInfo.quote_mint) return

    const reserve = await pumpSwapAdapter.getPoolReserves()
    console.log(reserve);

    const price = await pumpSwapAdapter.getPrice(reserve)
    console.log(price);

    const minQuoteAmount = pumpSwapAdapter.getSwapQuote(inputAmount, outPutMintAddr, reserve, 0.0)

    console.log(minQuoteAmount);

    const [baseAccount, quoteAccount] = await connection.getMultipleAccountsInfo([
        poolInfo.pool_base_token_account,
        poolInfo.pool_quote_token_account,
    ]);

    if (!baseAccount || !quoteAccount) {
        throw new Error("One or both token accounts not found");
    }

    const tx = new Transaction()

    const ix = await pumpSwapAdapter.getSwapInstruction(inputAmount, minQuoteAmount, {
        pool: new PublicKey(poolId),
        baseMint: poolInfo.base_mint,
        quoteMint: poolInfo.quote_mint,
        inputMint: new PublicKey(outPutMintAddr),
        baseTokenProgram: baseAccount.owner,
        quoteTokenProgram: quoteAccount.owner,
        user: payer.publicKey
    })

    tx.add(ix)

    tx.feePayer = payer.publicKey

    console.log(await connection.simulateTransaction(tx));

    const sig = await sendAndConfirmTransaction(connection, tx, [payer])

    console.log(sig);
}

pumpSwapParamTest()