import {
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from "@solana/spl-token";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { PumpSwapAdapter } from "@/adapter";
import { connection, payer } from "@/config";

const pumpSwapParamTest = async () => {
  const mintAddress = "6QHdT4x1BWmuFKYPixXu5BitzvKPTzALLehi3Cmsend";
  const INPUT_TOKEN_MINT = "6QHdT4x1BWmuFKYPixXu5BitzvKPTzALLehi3Cmsend" //* 6QHdT4x1BWmuFKYPixXu5BitzvKPTzALLehi3Cmsend / So11111111111111111111111111111111111111112
  const inputAmount = 50000000000
  const SLIPPAGE = 0

  const pumpSwapAdapter = await PumpSwapAdapter.create(
    connection,
    mintAddress,
    0
  );

  const getSwapKeys = await PumpSwapAdapter.getPoolsFromCa(
    connection,
    new PublicKey(mintAddress),
    payer.publicKey,
    0
  );
  console.log("PUMPSWAP KEYS : ", getSwapKeys);

  const poolInfo = pumpSwapAdapter.getPoolKeys();
  console.log("PUMPSWAP INFO : ", poolInfo);

  if (
    !poolInfo?.pool_base_token_account ||
    !poolInfo?.quote_mint ||
    !poolInfo.base_mint ||
    !poolInfo.quote_mint
  )
    return;

  const reserve = await pumpSwapAdapter.getPoolReserves();
  console.log("PUMPSWAP RESERVE : ", reserve);

  const price = pumpSwapAdapter.getPrice();
  console.log("PUMPSWAP PRICE : ", price);

  const minQuoteAmountWithSlippage = pumpSwapAdapter.getSwapQuote(
    inputAmount,
    INPUT_TOKEN_MINT,
    SLIPPAGE
  );
  console.log(`PUMPSWAP MinQuoteAmount With Slippage ${minQuoteAmountWithSlippage}`);

  const tx = new Transaction();

  const ix = await pumpSwapAdapter.getSwapInstruction(
    inputAmount,
    minQuoteAmountWithSlippage,
    {
      inputMint: new PublicKey(INPUT_TOKEN_MINT),
      user: payer.publicKey,
    }
  );

  //~ IF wallet don't have ATA , please add below Instruction
  // const [baseAccount, quoteAccount] = await connection.getMultipleAccountsInfo([
  //   poolInfo.pool_base_token_account,
  //   poolInfo.pool_quote_token_account,
  // ]);

  // if (!baseAccount || !quoteAccount) {
  //   throw new Error("One or both token accounts not found");
  // }

  // const ata1 = getAssociatedTokenAddressSync(
  //   new PublicKey(NATIVE_MINT),
  //   payer.publicKey
  // );
  // const ata2 = getAssociatedTokenAddressSync(
  //   new PublicKey(mintAddress),
  //   payer.publicKey
  // );
  // const ataIx1 = createAssociatedTokenAccountIdempotentInstruction(
  //   payer.publicKey,
  //   ata1,
  //   payer.publicKey,
  //   new PublicKey(NATIVE_MINT)
  // );

  // const ataIx2 = createAssociatedTokenAccountIdempotentInstruction(
  //   payer.publicKey,
  //   ata2,
  //   payer.publicKey,
  //   new PublicKey(mintAddress)
  // );

  // tx.add(ataIx1);
  // tx.add(ataIx2);
  //~ END

  //~ IF insufficient WSOL, uncomment below
  // const transferIx = SystemProgram.transfer({
  //   fromPubkey: payer.publicKey,
  //   toPubkey: ata1,
  //   lamports: inputAmount
  // })

  // const syncNativeIx = createSyncNativeInstruction(ata1)
  
  // tx.add(transferIx);
  // tx.add(syncNativeIx);
  //~ END
  
  tx.add(ix);

  tx.feePayer = payer.publicKey;

  console.log(await connection.simulateTransaction(tx));

  console.log(payer.publicKey.toBase58());
  

  const sig = await sendAndConfirmTransaction(connection, tx, [payer])

  console.log(sig);
};

pumpSwapParamTest();
