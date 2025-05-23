import { PublicKey } from "@solana/web3.js";

const SELL_EXACT_IN_DISCRIMINATOR = Buffer.from([
    149, 39, 222, 155, 211, 124, 152, 26,
]);

const BUY_EXACT_IN_DISCRIMINATOR = Buffer.from([
    250, 234, 13, 123, 213, 156, 19, 236,
]);

const RAYDIUM_LAUNCHLAB_MAINNET_ADDR = new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj")
const RAYDIUM_LAUNCHLAB_DEVNET_ADDR = new PublicKey("LanMV9sAd7wArD4vJFi2qDdfnVhFxYSUg6eADduJ3uj")

export const FEE_RATE_DENOMINATOR_VALUE = BigNumber(1_000_000);

const LAUNCHPAD_AUTH_SEED = Buffer.from("vault_auth_seed", "utf8");
const LAUNCHPAD_CONFIG_SEED = Buffer.from("global_config", "utf8");
const LAUNCHPAD_POOL_SEED = Buffer.from("pool", "utf8");
const LAUNCHPAD_POOL_VAULT_SEED = Buffer.from("pool_vault", "utf8");
const LAUNCHPAD_POOL_VESTING_SEED = Buffer.from("pool_vesting", "utf8");
const LAUNCHPAD_POOL_PLATFORM_SEED = Buffer.from("platform_config", "utf8");
const LAUNCHPAD_POOL_EVENT_AUTH_SEED = Buffer.from("__event_authority", "utf8");

export {
    SELL_EXACT_IN_DISCRIMINATOR,
    BUY_EXACT_IN_DISCRIMINATOR,
    RAYDIUM_LAUNCHLAB_MAINNET_ADDR,
    RAYDIUM_LAUNCHLAB_DEVNET_ADDR,
    LAUNCHPAD_AUTH_SEED,
    LAUNCHPAD_CONFIG_SEED,
    LAUNCHPAD_POOL_SEED,
    LAUNCHPAD_POOL_VAULT_SEED,
    LAUNCHPAD_POOL_VESTING_SEED,
    LAUNCHPAD_POOL_PLATFORM_SEED,
    LAUNCHPAD_POOL_EVENT_AUTH_SEED
}