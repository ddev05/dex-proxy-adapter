import { config } from "dotenv";

config()

const DEVNET_RPC = process.env.DEVNET_RPC || process.exit();
const MAINNET_RPC = process.env.MAINNET_RPC || process.exit();
const PRIVATEKEY = process.env.PRIVATEKEY || process.exit();



export {
    MAINNET_RPC, DEVNET_RPC, PRIVATEKEY
}