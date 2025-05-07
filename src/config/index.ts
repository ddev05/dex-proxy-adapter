import { config } from "dotenv";
import { bs58 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { Keypair } from "@solana/web3.js";

config()

const DEVNET_RPC = process.env.DEVNET_RPC || process.exit();
const PRIVATEKEY = process.env.PRIVATEKEY || process.exit();

const payer = Keypair.fromSecretKey(bs58.decode(PRIVATEKEY))

export {
    DEVNET_RPC , payer
}