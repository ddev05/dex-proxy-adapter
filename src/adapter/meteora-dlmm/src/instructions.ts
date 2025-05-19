import {
    PublicKey,
    TransactionInstruction,
    AccountMeta,
} from '@solana/web3.js';

/**
 * Creates a TransactionInstruction for swapping tokens on Meteora's DLMM.
 *
 * @param params - The parameters required to construct the instruction.
 * @returns A TransactionInstruction object ready to be added to a transaction.
 */
export function createMeteoraSwapInstruction({
    programId,
    pool,
    userSourceToken,
    userDestinationToken,
    aVault,
    bVault,
    aTokenVault,
    bTokenVault,
    aVaultLpMint,
    bVaultLpMint,
    aVaultLp,
    bVaultLp,
    protocolTokenFee,
    user,
    vaultProgram,
    tokenProgram,
    inAmount,
    minimumOutAmount,
}: {
    programId: PublicKey;
    pool: PublicKey;
    userSourceToken: PublicKey;
    userDestinationToken: PublicKey;
    aVault: PublicKey;
    bVault: PublicKey;
    aTokenVault: PublicKey;
    bTokenVault: PublicKey;
    aVaultLpMint: PublicKey;
    bVaultLpMint: PublicKey;
    aVaultLp: PublicKey;
    bVaultLp: PublicKey;
    protocolTokenFee: PublicKey;
    user: PublicKey;
    vaultProgram: PublicKey;
    tokenProgram: PublicKey;
    inAmount: number;
    minimumOutAmount: number;
}): TransactionInstruction {
    // Instruction discriminator for 'swap' (first 8 bytes of SHA256 hash of "global:swap")
    const discriminator = Buffer.from([248, 198, 158, 145, 225, 117, 135, 200]);

    // Serialize inAmount and minimumOutAmount as little-endian u64
    const inAmountBuffer = Buffer.alloc(8);
    inAmountBuffer.writeBigUInt64LE(BigInt(inAmount));

    const minOutAmountBuffer = Buffer.alloc(8);
    minOutAmountBuffer.writeBigUInt64LE(BigInt(minimumOutAmount));

    // Concatenate discriminator and serialized amounts to form instruction data
    const data = Buffer.concat([discriminator, inAmountBuffer, minOutAmountBuffer]);

    // Define the list of accounts required by the instruction
    const keys: AccountMeta[] = [
        { pubkey: pool, isSigner: false, isWritable: true },
        { pubkey: userSourceToken, isSigner: false, isWritable: true },
        { pubkey: userDestinationToken, isSigner: false, isWritable: true },
        { pubkey: aVault, isSigner: false, isWritable: true },
        { pubkey: bVault, isSigner: false, isWritable: true },
        { pubkey: aTokenVault, isSigner: false, isWritable: true },
        { pubkey: bTokenVault, isSigner: false, isWritable: true },
        { pubkey: aVaultLpMint, isSigner: false, isWritable: true },
        { pubkey: bVaultLpMint, isSigner: false, isWritable: true },
        { pubkey: aVaultLp, isSigner: false, isWritable: true },
        { pubkey: bVaultLp, isSigner: false, isWritable: true },
        { pubkey: protocolTokenFee, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: false },
        { pubkey: vaultProgram, isSigner: false, isWritable: false },
        { pubkey: tokenProgram, isSigner: false, isWritable: false },
    ];

    // Construct and return the TransactionInstruction
    return new TransactionInstruction({
        programId,
        keys,
        data,
    });
}