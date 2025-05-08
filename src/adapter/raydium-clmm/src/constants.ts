import { PublicKey } from "@solana/web3.js";

export const RAYDIUM_CLMM_MAINNET_ADDR = new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK");
export const RAYDIUM_CLMM_DEVNET_ADDR = new PublicKey("devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH");


export const AMM_CONFIG_SEED = "amm_config";
export const POOL_SEED = "pool";
export const POOL_VAULT_SEED = "pool_vault";
export const POOL_REWARD_VAULT_SEED = "pool_reward_vault";
export const POSITION_SEED = "position";
export const TICK_ARRAY_SEED = "tick_array";
export const OPERATION_SEED = "operation";
export const POOL_TICK_ARRAY_BITMAP_SEED = "pool_tick_array_bitmap_extension";
export const ORACLE_SEED = "observation";

export const TICK_ARRAY_SIZE = 60
export const TICK_ARRAY_BITMAP_SIZE = 512
export const EXTENSION_TICKARRAY_BITMAP_SIZE = 14