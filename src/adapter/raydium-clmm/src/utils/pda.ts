import { PublicKey } from "@solana/web3.js";
import { POOL_TICK_ARRAY_BITMAP_SEED, TICK_ARRAY_SEED } from "../constants";

export function getPdaTickArrayAddress(programId: PublicKey, poolId: PublicKey, startIndex: number) {
    const arr = new ArrayBuffer(4)
    const view = new DataView(arr)
    view.setInt32(0, startIndex, false)

    return PublicKey.findProgramAddressSync([Buffer.from(TICK_ARRAY_SEED), poolId.toBuffer(), new Uint8Array(arr)], programId)
}

export function getPdaExBitmapAccount(programId: PublicKey, poolId: PublicKey) {
    return PublicKey.findProgramAddressSync([Buffer.from(POOL_TICK_ARRAY_BITMAP_SEED), poolId.toBuffer()], programId)
}
