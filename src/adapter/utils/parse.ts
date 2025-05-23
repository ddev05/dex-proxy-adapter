import { PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";


function readBool(buf: Buffer, offset: number): boolean {
    const value = buf.readUInt8(offset);
    offset += 1;
    return value !== 0;
}

function readU8(buf: Buffer, offset: number): number {
    return buf.readUInt8(offset);
}

function readU16(buf: Buffer, offset: number): number {
    return buf.readUInt16LE(offset);
}

function readU64BN(buffer: Buffer, offset = 0): BigNumber {
    const bytes = buffer.slice(offset, offset + 8);
    let value = new BigNumber(0);
    for (let i = 0; i < 8; i++) {
        value = value.plus(new BigNumber(bytes[i]).multipliedBy(new BigNumber(2).pow(8 * i)));
    }
    return value;
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
    return new PublicKey(buf.slice(offset, offset + 32));
}

function parseStringFromBytes(data: Buffer | Uint8Array): string {
    // Find the first zero byte (null terminator) or use full length
    const zeroIndex = data.indexOf(0);
    const length = zeroIndex >= 0 ? zeroIndex : data.length;

    // Convert bytes to string using UTF-8 encoding, stopping at null terminator if any
    return data.slice(0, length).toString('utf8');
}

export {
    readBool,
    readU8,
    readU16,
    readU64BN,
    readPubkey,
    parseStringFromBytes
}