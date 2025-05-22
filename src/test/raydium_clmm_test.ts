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
import { RaydiumClmmAdapter } from "../adapter";
import { MAINNET_RPC, payer } from "../config";

const raydiumClmmSwapParam = {
  mainnet: {
    poolId: "reMcfsACf87GtohH6jvMgf9vKPmn5mtobfpcvkB5XJY",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "B4fTqWXqA1pQ8tzndSJPW1BH1TZvjKhFsTgTC2ogLhp",
    inputAmount: 0.0001 * LAMPORTS_PER_SOL,
    slippage: 1,
  },
  devnet: {
    poolId: "99vDLcFwPCFFAusmBNkG8qo8zMxka8hrjp3iPR14BDsb",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "AMww6tqcaPUq4bVn1W7hKLQmNAe56d1yRFSKtV687uai",
    inputAmount: 0.001 * LAMPORTS_PER_SOL,
    slippage: 0,
  },
  localnet: {
    poolId: "reMcfsACf87GtohH6jvMgf9vKPmn5mtobfpcvkB5XJY",
    inputMintAddr: "So11111111111111111111111111111111111111112",
    outPutMintAddr: "B4fTqWXqA1pQ8tzndSJPW1BH1TZvjKhFsTgTC2ogLhp",
    inputAmount: 0.01 * LAMPORTS_PER_SOL,
    slippage: 0,
  },
};

function findCreatorVaultPDA(
  bondingCurveCreator: PublicKey,
  programId: PublicKey
) {
  const seed1 = Buffer.from("creator-vault"); // const seed
  const seed2 = bondingCurveCreator.toBuffer(); // public key seed

  const [pda, bump] = PublicKey.findProgramAddressSync(
    [seed1, seed2],
    programId
  );

  return { pda, bump };
}
const raydiumClmmSwapParamTest = async () => {
  // findCreatorVaultPDA()

  console.log("Payer ", payer.publicKey.toBase58());

  const { inputAmount, inputMintAddr, outPutMintAddr, poolId, slippage } =
    raydiumClmmSwapParam.mainnet;
  const targetInputMint = inputMintAddr;

  const connection = new Connection(MAINNET_RPC, "processed");
  // const connection = new Connection(DEVNET_RPC, "processed")

  const rayClmmAdapter = await RaydiumClmmAdapter.create(
    connection,
    poolId,
    "mainnet"
  );

  const poolInfo = await rayClmmAdapter.getPoolKeys();

  console.log(poolInfo);

  const price = await rayClmmAdapter.getPrice();
  console.log(price);

  const adapterData = rayClmmAdapter.getSwapQuote(
    inputAmount,
    targetInputMint,
    null,
    slippage
  );

  console.log(adapterData);

  const tx = new Transaction();

  const ataA = getAssociatedTokenAddressSync(
    rayClmmAdapter.poolInfo.mintA,
    payer.publicKey
  );
  const ataB = getAssociatedTokenAddressSync(
    rayClmmAdapter.poolInfo.mintB,
    payer.publicKey
  );

  const createAtaA = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    ataA,
    payer.publicKey,
    rayClmmAdapter.poolInfo.mintA
  );
  const createAtaB = createAssociatedTokenAccountIdempotentInstruction(
    payer.publicKey,
    ataB,
    payer.publicKey,
    rayClmmAdapter.poolInfo.mintB
  );

  console.log(inputAmount, adapterData.amountOut);

  const ix = rayClmmAdapter.getSwapInstruction(
    inputAmount,
    adapterData.amountOut,
    {
      inputMint: new PublicKey(targetInputMint),
      payer: payer.publicKey,
      remainingAccounts: adapterData.remainingAccount,
      xPrice: adapterData.xPrice,
    }
  );

  console.log(adapterData.remainingAccount);

  tx.add(createAtaA).add(createAtaB).add(ix);

  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  console.log(await connection.simulateTransaction(tx));

  const sig = await sendAndConfirmTransaction(connection, tx, [payer], {
    skipPreflight: true,
  });

  console.log(sig);
};

raydiumClmmSwapParamTest();
