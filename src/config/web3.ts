import { Connection, Keypair } from "@solana/web3.js";
import { MAINNET_RPC, PRIVATEKEY } from "./envConfig";
import bs58 from "bs58";

const connection = new Connection(MAINNET_RPC, "processed")
const payer = Keypair.fromSecretKey(bs58.decode(PRIVATEKEY))

export {
    connection, payer
}