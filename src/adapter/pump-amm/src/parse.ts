import { PublicKey } from "@solana/web3.js";
import { PumpSwapPoolInfo } from "./types"; // You should define this interface separately

export function parsePool(buffer: Buffer): PumpSwapPoolInfo {
    let offset = 8;

    function readU8(): number {
        const value = buffer.readUInt8(offset);
        offset += 1;
        return value;
    }

    function readU16(): number {
        const value = buffer.readUInt16LE(offset);
        offset += 2;
        return value;
    }

    function readU64(): bigint {
        const value = buffer.readBigUInt64LE(offset);
        offset += 8;
        return value;
    }

    function readPubkey(): PublicKey {
        const key = buffer.slice(offset, offset + 32);
        offset += 32;
        return new PublicKey(key);
    }

    const pool: PumpSwapPoolInfo = {
        pool_bump: readU8(),
        index: readU16(),
        creator: readPubkey(),
        base_mint: readPubkey(),
        quote_mint: readPubkey(),
        lp_mint: readPubkey(),
        pool_base_token_account: readPubkey(),
        pool_quote_token_account: readPubkey(),
        lp_supply: readU64(),
    };

    return pool;
}