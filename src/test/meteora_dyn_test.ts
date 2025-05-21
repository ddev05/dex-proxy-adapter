import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  LAMPORTS_PER_SOL,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import { MeteoraDynAdapter } from "../adapter/meteora-dyn";
import { MAINNET_RPC, payer } from "../config";

const meteoraDynParam = {
  mainnet: {
    poolId: "BPq2BgQjn6a4KFVY7dWnKEJ98uWcAxBrDghEd9Ld1q9S",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "9XjiBXqM8yKk345CMtrWsfoVeXvGZxk1xZD4bdTEbTcv",
    // inputAmount: 0.000001 * LAMPORTS_PER_SOL,
    inputAmount: 0.00001 * LAMPORTS_PER_SOL,
    slippage: 0.01,
  },
  devnet: {
    poolId: "H2QbwERVNPPWX568MLdbEqE1wfdEijX8jUYAbKDKtw4X",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "9eY4FKSmPvYVq5WPUvjcuX8cpDLzMGbgUfPxnxQ8UjzP",
    inputAmount: 1 * LAMPORTS_PER_SOL,
    slippage: 0,
  },
  localnet: {
    poolId: "BPq2BgQjn6a4KFVY7dWnKEJ98uWcAxBrDghEd9Ld1q9S",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "9XjiBXqM8yKk345CMtrWsfoVeXvGZxk1xZD4bdTEbTcv",
    inputAmount: 0.01 * LAMPORTS_PER_SOL,
    slippage: 0,
  },
};

const meteoraDynTest = async () => {
  console.log(payer.publicKey.toBase58());

  const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } =
    meteoraDynParam.mainnet;

  const connection = new Connection(MAINNET_RPC, "processed");

  const meteoraAdapter = await MeteoraDynAdapter.create(
    connection,
    poolId,
    "mainnet"
  );

  const poolInfo = meteoraAdapter.getPoolKeys();
  console.log(poolInfo);

  const reserve = await meteoraAdapter.getPoolReserves();
  console.log(reserve);

  const price = await meteoraAdapter.getPrice(reserve);
  console.log(price);

  const minQuoteAmount = meteoraAdapter.getSwapQuote(
    inputAmount,
    inputMintAddr,
    0.0
  );
  console.log("minQuoteAmount ", minQuoteAmount.toNumber());

  const ata = getAssociatedTokenAddressSync(
    new PublicKey(outPutMintAddr),
    payer.publicKey
  );
  const ataIx = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    new PublicKey(outPutMintAddr)
  );

  const tx = new Transaction();

  const ix = await meteoraAdapter.getSwapInstruction(
    inputAmount,
    minQuoteAmount.toNumber(),
    {
      inputMint: new PublicKey(inputMintAddr),
      user: payer.publicKey,
    }
  );

  tx.add(ataIx);
  tx.add(ix);

  tx.feePayer = payer.publicKey;

  console.log(await connection.simulateTransaction(tx));

  // const sig = await sendAndConfirmTransaction(connection, tx, [payer] , {skipPreflight : true})

  // console.log(sig);
};

meteoraDynTest();
