import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export const RAYDIUM_CLMM_MAINNET_ADDR = new PublicKey("CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK");
export const RAYDIUM_CLMM_DEVNET_ADDR = new PublicKey("devi51mZmdwUJGU9hjN27vEz64Gps7uUefqxg27EAtH");
export const MEMO_PROGRAM_ID =  new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

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
export const TICK_SIZE = 104;       // Size of a single tick in bytes (i32 + i128 + u128 + u128 + u128*3)

export const MIN_SQRT_PRICE_X64: BN = new BN('4295048016')
export const MAX_SQRT_PRICE_X64: BN = new BN('79226673521066979257578248091')

export const MIN_TICK = -443636
export const MAX_TICK = -MIN_TICK

export const Q128 = new BN(1).shln(128)
export const MaxUint128 = Q128.subn(1)

export const BIT_PRECISION = 16
export const LOG_B_2_X32 = '59543866431248'
export const LOG_B_P_ERR_MARGIN_LOWER_X64 = '184467440737095516'
export const LOG_B_P_ERR_MARGIN_UPPER_X64 = '15793534762490258745'

export const U64Resolution = 64

export const Q64 = new BN(1).shln(64)

export const FEE_RATE_DENOMINATOR = new BN(10).pow(new BN(6))