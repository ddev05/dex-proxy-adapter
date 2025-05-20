import { Connection, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, Transaction } from "@solana/web3.js";
import { DEVNET_RPC, MAINNET_RPC, payer } from "../config";
import { PumpSwapAdapter } from "../adapter";

const pumpAmmSwapParam = {
    mainnet: {
        poolId: "9P9EQxyBrJfhwhtt6wQZsB3VAs7LQwbUXjRS3YrYQp2P",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "6QHdT4x1BWmuFKYPixXu5BitzvKPTzALLehi3Cmsend",
        inputAmount: 10 * LAMPORTS_PER_SOL,
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
        poolId: "9P9EQxyBrJfhwhtt6wQZsB3VAs7LQwbUXjRS3YrYQp2P",
        inputMintAddr: "So11111111111111111111111111111111111111112",
        outPutMintAddr: "6QHdT4x1BWmuFKYPixXu5BitzvKPTzALLehi3Cmsend",
        inputAmount: 0.01 * LAMPORTS_PER_SOL,
        slippage: 0
    },
}


const pumpSwapParamTest = async () => {

    const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } = pumpAmmSwapParam.mainnet

    const connection = new Connection(MAINNET_RPC, "processed")
    const pumpSwapAdapter = await PumpSwapAdapter.create(connection, poolId, "mainnet")

    const poolInfo = pumpSwapAdapter.getPoolKeys()
    console.log(poolInfo);

    if (!poolInfo?.pool_base_token_account || !poolInfo?.quote_mint || !poolInfo.base_mint || !poolInfo.quote_mint) return

    const reserve = await pumpSwapAdapter.getPoolReserves()
    console.log(reserve);

    const price = await pumpSwapAdapter.getPrice(reserve)
    console.log(price);

    const minQuoteAmount = pumpSwapAdapter.getSwapQuote(inputAmount, inputMintAddr, reserve, 0.0)

    const getSwapKeys = await PumpSwapAdapter.getPoolsFromCa(connection, new PublicKey(outPutMintAddr), payer.publicKey , 0)

    console.log("Here is swap keys : ", getSwapKeys);

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
        inputMint: new PublicKey(inputMintAddr),
        baseTokenProgram: baseAccount.owner,
        quoteTokenProgram: quoteAccount.owner,
        user: payer.publicKey
    })

    tx.add(ix)

    tx.feePayer = payer.publicKey

    console.log(await connection.simulateTransaction(tx));

    // const sig = await sendAndConfirmTransaction(connection, tx, [payer])

    // console.log(sig);
}

pumpSwapParamTest()