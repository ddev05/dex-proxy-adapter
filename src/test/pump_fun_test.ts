import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { PumpfunAdapter } from "../adapter";
import { MAINNET_RPC, payer } from "../config";

const pumpFunParam = {
  mainnet: {
    poolId: "14mXzvRcSc6sLALhyk7wwJYhF9J7fTJLVC2oE31fz7GN",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "Cf3DM7Fm8L6rZfwxmnvAguJYc499qU6SuEgsx638pump",
    inputAmount: 0.0001 * LAMPORTS_PER_SOL,
    slippage: 0,
  },
  devnet: {
    poolId: "H2QbwERVNPPWX568MLdbEqE1wfdEijX8jUYAbKDKtw4X",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "9eY4FKSmPvYVq5WPUvjcuX8cpDLzMGbgUfPxnxQ8UjzP",
    inputAmount: 1 * LAMPORTS_PER_SOL,
    slippage: 0,
  },
  localnet: {
    poolId: "14mXzvRcSc6sLALhyk7wwJYhF9J7fTJLVC2oE31fz7GN",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "Cf3DM7Fm8L6rZfwxmnvAguJYc499qU6SuEgsx638pump",
    inputAmount: 0.01 * LAMPORTS_PER_SOL,
    slippage: 0,
  },
};

const pumpFunTest = async () => {
  const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } =
    pumpFunParam.mainnet;

  const TARGET_MINT = outPutMintAddr;

  const connection = new Connection(MAINNET_RPC, "processed");
  const pumpfunAdaptor = await PumpfunAdapter.create(
    connection,
    outPutMintAddr,
    "mainnet"
  );

  const poolInfo = pumpfunAdaptor.getPoolKeys();
  console.log(poolInfo);

  const reserve = await pumpfunAdaptor.getPoolReserves();
  console.log(reserve);

  const price = await pumpfunAdaptor.getPrice(reserve);
  console.log(price);

  const minQuoteAmount = pumpfunAdaptor.getSwapQuote(
    inputAmount,
    TARGET_MINT,
    reserve,
    slippage
  );

  console.log("minQuoteAmount ", minQuoteAmount);

  // const getSwapKeys = await PumpfunAdapter.getPoolsFromCa(connection, new PublicKey(outPutMintAddr), payer.publicKey)
  // console.log("Here is swap keys : ", getSwapKeys);

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

  console.log("Input mint address : ", inputMintAddr);
  console.log("minQuoteAmount ", minQuoteAmount);

  const tx = new Transaction();

  const ix = await pumpfunAdaptor.getSwapInstruction(
    inputAmount,
    minQuoteAmount,
    {
      inputMint: new PublicKey(TARGET_MINT),
      payer: payer.publicKey,
    }
  );

  tx.add(ataIx1);
  tx.add(ataIx2);
  tx.add(ix);

  tx.feePayer = payer.publicKey;

  console.log(await connection.simulateTransaction(tx));

  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

  console.log(sig);
};

pumpFunTest();
