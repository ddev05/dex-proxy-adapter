import { Keypair } from "@solana/web3.js";
import { config } from "dotenv";
import bs58 from "bs58";

config()

const DEVNET_RPC = process.env.DEVNET_RPC || process.exit();
const MAINNET_RPC = process.env.MAINNET_RPC || process.exit();
const PRIVATEKEY = process.env.PRIVATEKEY || process.exit();

const payer = Keypair.fromSecretKey(bs58.decode(PRIVATEKEY))

export {
    MAINNET_RPC , DEVNET_RPC , payer
}