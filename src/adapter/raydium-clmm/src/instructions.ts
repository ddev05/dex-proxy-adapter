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
    remainingAccounts = [],
    cluster
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
    remainingAccounts: AccountMeta[],
    cluster: "mainnet" | "devnet"
}): TransactionInstruction {
    const discriminator = Buffer.from([43, 4, 237, 11, 26, 201, 30, 98]);

    const ixData = Buffer.alloc(8 + 8 + 16 + 1);
    let offset = 0;

    // Amount
    ixData.writeBigUInt64LE(BigInt(amount), offset);
    offset += 8;

    // Other amount threshold
    ixData.writeBigUInt64LE(BigInt(otherAmountThreshold), offset);
    offset += 8;

    // Sqrt price limit
    ixData.writeBigUInt64LE(sqrtPriceLimitX64, offset);
    offset += 16;

    // Is base input flag
    ixData.writeUInt8(isBaseInput ? 1 : 0, offset);
    offset += 1;

    const data = Buffer.concat([discriminator, ixData])

    const keys: AccountMeta[] = cluster == "mainnet" ?
        [
            { pubkey: payer, isSigner: true, isWritable: true },
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
            ...remainingAccounts
        ] : [
            { pubkey: payer, isSigner: true, isWritable: true },
            { pubkey: ammConfig, isSigner: false, isWritable: false },
            { pubkey: poolState, isSigner: false, isWritable: true },
            { pubkey: outputTokenAccount, isSigner: false, isWritable: true },
            { pubkey: inputTokenAccount, isSigner: false, isWritable: true },
            { pubkey: outputVault, isSigner: false, isWritable: true },
            { pubkey: inputVault, isSigner: false, isWritable: true },
            { pubkey: observationState, isSigner: false, isWritable: true },
            { pubkey: tokenProgram, isSigner: false, isWritable: false },
            { pubkey: tokenProgram2022, isSigner: false, isWritable: false },
            { pubkey: memoProgram, isSigner: false, isWritable: false },
            { pubkey: outputVaultMint, isSigner: false, isWritable: false },
            { pubkey: inputVaultMint, isSigner: false, isWritable: false },
            ...remainingAccounts
        ];

    return new TransactionInstruction({
        programId,
        keys,
        data,
    });
}