import {
    PublicKey,
    TransactionInstruction,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import { Buffer } from "buffer";
import { bigNumberToLEBuffer } from "../../utils/bigNumber";
import { BUY_EXACT_IN_DISCRIMINATOR, SELL_EXACT_IN_DISCRIMINATOR } from "./constants";

export function buyExactInIx(
    programId: PublicKey,
    payer: PublicKey,
    authority: PublicKey,
    globalConfig: PublicKey,
    platformConfig: PublicKey,
    poolState: PublicKey,
    userBaseToken: PublicKey,
    userQuoteToken: PublicKey,
    baseVault: PublicKey,
    quoteVault: PublicKey,
    baseTokenMint: PublicKey,
    quoteTokenMint: PublicKey,
    baseTokenProgram: PublicKey,
    quoteTokenProgram: PublicKey,
    eventAuthority: PublicKey,
    amountIn: number,
    minimumAmountOut: number,
    shareFeeRate: number
): TransactionInstruction {

    const discriminator = Buffer.from(BUY_EXACT_IN_DISCRIMINATOR); // Raydium v4 swap_base_in discriminator
    const amountInBuf = Buffer.alloc(8);
    const minimumAmountOutBuf = Buffer.alloc(8);
    const shareFeeRateBuf = Buffer.alloc(8);
    amountInBuf.writeBigUInt64LE(BigInt(amountIn));
    minimumAmountOutBuf.writeBigUInt64LE(BigInt(minimumAmountOut));
    shareFeeRateBuf.writeBigUInt64LE(BigInt(shareFeeRate));
    
    const data = Buffer.concat([discriminator, amountInBuf, minimumAmountOutBuf, shareFeeRateBuf]);
    
    
    const keys = [
        { pubkey: payer, isSigner: true, isWritable: false },
        { pubkey: authority, isSigner: false, isWritable: false },
        { pubkey: globalConfig, isSigner: false, isWritable: false },
        { pubkey: platformConfig, isSigner: false, isWritable: false },
        { pubkey: poolState, isSigner: false, isWritable: true },
        { pubkey: userBaseToken, isSigner: false, isWritable: true },
        { pubkey: userQuoteToken, isSigner: false, isWritable: true },
        { pubkey: baseVault, isSigner: false, isWritable: true },
        { pubkey: quoteVault, isSigner: false, isWritable: true },
        { pubkey: baseTokenMint, isSigner: false, isWritable: false },
        { pubkey: quoteTokenMint, isSigner: false, isWritable: false },
        { pubkey: baseTokenProgram, isSigner: false, isWritable: false },
        { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
    ];
    
    return new TransactionInstruction({
        keys,
        programId,
        data,
    });
}

export function sellExactInIx(
    programId: PublicKey,
    payer: PublicKey,
    authority: PublicKey,
    globalConfig: PublicKey,
    platformConfig: PublicKey,
    poolState: PublicKey,
    userBaseToken: PublicKey,
    userQuoteToken: PublicKey,
    baseVault: PublicKey,
    quoteVault: PublicKey,
    baseTokenMint: PublicKey,
    quoteTokenMint: PublicKey,
    baseTokenProgram: PublicKey,
    quoteTokenProgram: PublicKey,
    eventAuthority: PublicKey,
    amountIn: number,
    minimumAmountOut: number,
    shareFeeRate: number
): TransactionInstruction {
    const discriminator = Buffer.from(SELL_EXACT_IN_DISCRIMINATOR); // Raydium v4 swap_base_in discriminator
    const amountInBuf = Buffer.alloc(8);
    const minimumAmountOutBuf = Buffer.alloc(8);
    const shareFeeRateBuf = Buffer.alloc(8);
    amountInBuf.writeBigUInt64LE(BigInt(amountIn));
    minimumAmountOutBuf.writeBigUInt64LE(BigInt(minimumAmountOut));
    shareFeeRateBuf.writeBigUInt64LE(BigInt(shareFeeRate));
    
    const data = Buffer.concat([discriminator, amountInBuf, minimumAmountOutBuf, shareFeeRateBuf]);

    const keys = [
        { pubkey: payer, isSigner: true, isWritable: false },
        { pubkey: authority, isSigner: false, isWritable: false },
        { pubkey: globalConfig, isSigner: false, isWritable: false },
        { pubkey: platformConfig, isSigner: false, isWritable: false },
        { pubkey: poolState, isSigner: false, isWritable: true },
        { pubkey: userBaseToken, isSigner: false, isWritable: true },
        { pubkey: userQuoteToken, isSigner: false, isWritable: true },
        { pubkey: baseVault, isSigner: false, isWritable: true },
        { pubkey: quoteVault, isSigner: false, isWritable: true },
        { pubkey: baseTokenMint, isSigner: false, isWritable: false },
        { pubkey: quoteTokenMint, isSigner: false, isWritable: false },
        { pubkey: baseTokenProgram, isSigner: false, isWritable: false },
        { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
        keys,
        programId,
        data,
    });
}