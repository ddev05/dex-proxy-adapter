import { AccountMeta, PublicKey, TransactionInstruction } from "@solana/web3.js";

export function createAmmV3SwapV2Instruction({
    programId,
    payer,
    ammConfig,
    poolState,
    inputTokenAccount,
    outputTokenAccount,
    inputVault,
    outputVault,
    observationState,
    tokenProgram,
    tokenProgram2022,
    memoProgram,
    inputVaultMint,
    outputVaultMint,
    amount,
    otherAmountThreshold,
    sqrtPriceLimitX64,
    isBaseInput,
}: {
    programId: PublicKey;
    payer: PublicKey;
    ammConfig: PublicKey;
    poolState: PublicKey;
    inputTokenAccount: PublicKey;
    outputTokenAccount: PublicKey;
    inputVault: PublicKey;
    outputVault: PublicKey;
    observationState: PublicKey;
    tokenProgram: PublicKey;
    tokenProgram2022: PublicKey;
    memoProgram: PublicKey;
    inputVaultMint: PublicKey;
    outputVaultMint: PublicKey;
    amount: number | bigint;
    otherAmountThreshold: number | bigint;
    sqrtPriceLimitX64: bigint;
    isBaseInput: boolean;
}): TransactionInstruction {
    const data = Buffer.alloc(1 + 8 + 8 + 16 + 1);
    let offset = 0;

    // Instruction discriminator (you'll need to check the actual IDL for the correct index)
    data.writeUInt8(16, offset); // Assuming swapV2 is instruction index 16
    offset += 1;

    // Amount
    data.writeBigUInt64LE(BigInt(amount), offset);
    offset += 8;

    // Other amount threshold
    data.writeBigUInt64LE(BigInt(otherAmountThreshold), offset);
    offset += 8;

    // Sqrt price limit
    data.writeBigUInt64LE(sqrtPriceLimitX64, offset);
    offset += 16;

    // Is base input flag
    data.writeUInt8(isBaseInput ? 1 : 0, offset);
    offset += 1;

    const keys: AccountMeta[] = [
        { pubkey: payer, isSigner: true, isWritable: false },
        { pubkey: ammConfig, isSigner: false, isWritable: false },
        { pubkey: poolState, isSigner: false, isWritable: true },
        { pubkey: inputTokenAccount, isSigner: false, isWritable: true },
        { pubkey: outputTokenAccount, isSigner: false, isWritable: true },
        { pubkey: inputVault, isSigner: false, isWritable: true },
        { pubkey: outputVault, isSigner: false, isWritable: true },
        { pubkey: observationState, isSigner: false, isWritable: true },
        { pubkey: tokenProgram, isSigner: false, isWritable: false },
        { pubkey: tokenProgram2022, isSigner: false, isWritable: false },
        { pubkey: memoProgram, isSigner: false, isWritable: false },
        { pubkey: inputVaultMint, isSigner: false, isWritable: false },
        { pubkey: outputVaultMint, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
        programId,
        keys,
        data,
    });
}