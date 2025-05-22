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
import { RaydiumLaunchlabAdapter } from "../adapter/raydium-launchpad";
import { MAINNET_RPC, payer } from "../config";

const raydiumLaunchPadParam = {
  mainnet: {
    poolId: "9pycax4NJg4RmuHB9NT9ZKAJ3mEsnqLEbPrKGS1whfxG",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "2GukS36zyoR7ZMyHdRD3F1T4y5xYU1N953YnNmuEBray",
    inputAmount: 0.00001 * LAMPORTS_PER_SOL,
    slippage: 0.01,
  },
  devnet: {
    poolId: "E1jS21jo1yuXaKHkD8qzAxcxD1a5w5LTHJRghzQH8vV7",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "6RHcynG6VNXZvHkSVgL9XoWW1EmjAz1U3Hvu6JBKDwZH",
    inputAmount: 0.00001 * LAMPORTS_PER_SOL,
    slippage: 0,
  },
  localnet: {
    poolId: "9pycax4NJg4RmuHB9NT9ZKAJ3mEsnqLEbPrKGS1whfxG",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "2GukS36zyoR7ZMyHdRD3F1T4y5xYU1N953YnNmuEBray",
    inputAmount: 0.01 * LAMPORTS_PER_SOL,
    slippage: 0,
  },
};

const raydiumLaunchPadParamTest = async () => {
  const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } =
    raydiumLaunchPadParam.mainnet;

  const TARGET_MINT = inputMintAddr;

  const connection = new Connection(MAINNET_RPC, "processed");

  const rayLaunchAdapter = await RaydiumLaunchlabAdapter.create(
    connection,
    poolId
  );

  const poolKeys = rayLaunchAdapter.getPoolKeys();
  console.log("poolKeys ", poolKeys);
  const poolReserves = await rayLaunchAdapter.getPoolReserves();
  console.log("poolReserves ", poolReserves);
  const price = await rayLaunchAdapter.getPrice();
  console.log("price ", price);

  const minQuoteAmount = rayLaunchAdapter.getSwapQuote(
    inputAmount,
    outPutMintAddr,
    null,
    0.0
  );
  console.log("minQuoteAmount ", minQuoteAmount.toString());

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

  const ix = rayLaunchAdapter.getSwapInstruction(
    inputAmount,
    Math.floor(minQuoteAmount),
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

raydiumLaunchPadParamTest();
