import {
  PublicKey,
  sendAndConfirmTransaction,
  Transaction
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync
} from "@solana/spl-token";
import { PumpfunAdapter } from "@/adapter";
import {
  connection,
  payer
} from "@/config";



const pumpFunTest = async () => {

  const mintAddress = "Cf3DM7Fm8L6rZfwxmnvAguJYc499qU6SuEgsx638pump";
  const INPUT_TOKEN_MINT = "Cf3DM7Fm8L6rZfwxmnvAguJYc499qU6SuEgsx638pump" //* Cf3DM7Fm8L6rZfwxmnvAguJYc499qU6SuEgsx638pump / So11111111111111111111111111111111111111112
  const inputAmount = 10000000000
  const SLIPPAGE = 0.01

  const pumpfunAdaptor = await PumpfunAdapter.create(connection, mintAddress)

  const getSwapKeys = await PumpfunAdapter.getPoolsFromCa(connection, new PublicKey(mintAddress), payer.publicKey)
  console.log("PUMPFUN KEYS : ", getSwapKeys);

  const poolInfo = pumpfunAdaptor.getPoolKeys();
  console.log("PUMPFUN INFO : ", poolInfo);

  const reserve = await pumpfunAdaptor.getPoolReserves();
  console.log("PUMPFUN RESERVE : ", reserve);

  const price = pumpfunAdaptor.getPrice()
  console.log("PUMPFUN PRICE : ", price);

  const minQuoteAmountWithSlippage = pumpfunAdaptor.getSwapQuote(inputAmount, INPUT_TOKEN_MINT, SLIPPAGE)
  console.log(`PUMPFUN MinQuoteAmount With Slippage ${minQuoteAmountWithSlippage}`);

  const tx = new Transaction();

  const ix = await pumpfunAdaptor.getSwapInstruction(
    inputAmount,
    minQuoteAmountWithSlippage,
    {
      inputMint: new PublicKey(INPUT_TOKEN_MINT),
      payer: payer.publicKey,
    }
  );

  //~ IF wallet don't have ATA , please add below Instruction
  // const ata = getAssociatedTokenAddressSync(new PublicKey(mintAddress), payer.publicKey)
  // const ataIx = createAssociatedTokenAccountIdempotentInstruction(payer.publicKey, ata, payer.publicKey, new PublicKey(mintAddress))
  // tx.add(ataIx);
  //~ END

  tx.add(ix);

  tx.feePayer = payer.publicKey;

  console.log(await connection.simulateTransaction(tx));

  const sig = await sendAndConfirmTransaction(connection, tx, [payer]);

  console.log(sig);
};

pumpFunTest();
