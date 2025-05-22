import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
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
    slippage: 0.1,
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

  const targetMint = inputMintAddr;

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
    targetMint,
    slippage
  );
  console.log("minQuoteAmount ", minQuoteAmount.toNumber());

  const ata = getAssociatedTokenAddressSync(
    new PublicKey(inputMintAddr),
    payer.publicKey
  );
  const ata2 = getAssociatedTokenAddressSync(
    new PublicKey(outPutMintAddr),
    payer.publicKey
  );
  const ataIx1 = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    ata,
    payer.publicKey,
    new PublicKey(inputMintAddr)
  );

  const ataIx2 = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    ata2,
    payer.publicKey,
    new PublicKey(outPutMintAddr)
  );

  const tx = new Transaction();

  const ix = await meteoraAdapter.getSwapInstruction(
    inputAmount,
    minQuoteAmount.toNumber(),
    {
      inputMint: new PublicKey(targetMint),
      user: payer.publicKey,
    }
  );

  tx.add(ataIx1);
  tx.add(ataIx2);
  tx.add(ix);

  // Set priority fee for the transaction
  tx.instructions.forEach((instruction) => {
    instruction.keys.push({
      pubkey: payer.publicKey,
      isSigner: true,
      isWritable: true,
    });
  });

  // Add compute budget instruction to set priority fee
  const priorityFeeInstruction = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 100_000, // Adjust this value based on network congestion
  });

  // Add the priority fee instruction at the beginning of the transaction
  tx.instructions.unshift(priorityFeeInstruction);

  tx.feePayer = payer.publicKey;

  // console.log(await connection.simulateTransaction(tx));
  try {
    const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
      skipPreflight: true,
    });
    console.log(sig);
  } catch (error) {
    console.log(error);
  }
};

meteoraDynTest();
