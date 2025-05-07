import { PublicKey } from "@solana/web3.js";
import { GlobalConfig, Pool } from "./types"; // You should define this interface separately

export function parsePool(buffer: Buffer): Pool {
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

    const pool: Pool = {
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

export function parseGlobalConfig(buffer: Buffer): GlobalConfig {
    let offset = 8;

    function readU64(): bigint {
        const val = buffer.readBigUInt64LE(offset);
        offset += 8;
        return val;
    }

    function readU8(): number {
        return buffer.readUInt8(offset++);
    }

    function readPubkey(): PublicKey {
        const key = new PublicKey(buffer.slice(offset, offset + 32));
        offset += 32;
        return key;
    }

    const admin = readPubkey();
    const lp_fee_basis_points = readU64();
    const protocol_fee_basis_points = readU64();
    const disable_flags = readU8();

    const protocol_fee_recipients: PublicKey[] = [];
    for (let i = 0; i < 8; i++) {
        protocol_fee_recipients.push(readPubkey());
    }

    console.log(offset);

    return {
        admin,
        lp_fee_basis_points,
        protocol_fee_basis_points,
        disable_flags,
        protocol_fee_recipients,
    };
}