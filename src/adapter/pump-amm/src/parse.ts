import { PublicKey } from "@solana/web3.js";
import { PumpSwapPoolInfo } from "./types"; // You should define this interface separately
import { readPubkey, readU16, readU64BN, readU8 } from "@/adapter/utils";

export function parsePool(buffer: Buffer): PumpSwapPoolInfo {
    let offset = 8;

    const pool_bump = readU8(buffer, offset);
    offset += 1;
    const index = readU16(buffer, offset);
    offset += 2;
    const creator = readPubkey(buffer, offset);
    offset += 32;
    const base_mint = readPubkey(buffer, offset);
    offset += 32;
    const quote_mint = readPubkey(buffer, offset);
    offset += 32;
    const lp_mint = readPubkey(buffer, offset);
    offset += 32;
    const pool_base_token_account = readPubkey(buffer, offset);
    offset += 32;
    const pool_quote_token_account = readPubkey(buffer, offset);
    offset += 32;
    const lp_supply = readU64BN(buffer, offset);
    offset += 8;
    const coin_creator = readPubkey(buffer, offset);
    offset += 32;

    const pool: PumpSwapPoolInfo = {
        pool_bump,
        index,
        creator,
        base_mint,
        quote_mint,
        lp_mint,
        pool_base_token_account,
        pool_quote_token_account,
        lp_supply,
        coin_creator,
    };

    return pool;
}