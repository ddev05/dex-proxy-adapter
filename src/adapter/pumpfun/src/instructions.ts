import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import BigNumber from 'bignumber.js';
import { bigNumberToLEBuffer } from '../../utils/bigNumber';

export function pumpfunBuyIx(
    programId: PublicKey,
    global: PublicKey,
    feeRecipient: PublicKey,
    mint: PublicKey,
    bondingCurve: PublicKey,
    associatedBondingCurve: PublicKey,
    associatedUser: PublicKey,
    user: PublicKey,
    tokenProgram: PublicKey,
    rent: PublicKey,
    eventAuthority: PublicKey,
    amount: BigNumber,
    maxSolCost: BigNumber
): TransactionInstruction {
    const discriminator = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]); // "buy"
    const data = Buffer.concat([
        discriminator,
        bigNumberToLEBuffer(amount),
        bigNumberToLEBuffer(maxSolCost),
    ]);

    const keys = [
        { pubkey: global, isSigner: false, isWritable: false },
        { pubkey: feeRecipient, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedUser, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: tokenProgram, isSigner: false, isWritable: false },
        { pubkey: rent, isSigner: false, isWritable: true },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
        keys,
        programId,
        data,
    });
}

export function pumpfunSellIx(
    programId: PublicKey,
    global: PublicKey,
    feeRecipient: PublicKey,
    mint: PublicKey,
    bondingCurve: PublicKey,
    associatedBondingCurve: PublicKey,
    associatedUser: PublicKey,
    user: PublicKey,
    systemProgram: PublicKey,
    rent: PublicKey,
    associatedTokenProgram: PublicKey,
    tokenProgram: PublicKey,
    eventAuthority: PublicKey,
    amount: BigNumber,
    minSolOutput: BigNumber
): TransactionInstruction {
    const discriminator = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]); // "sell"
    const data = Buffer.concat([
        discriminator,
        bigNumberToLEBuffer(amount),
        bigNumberToLEBuffer(minSolOutput),
    ]);

    const keys = [
        { pubkey: global, isSigner: false, isWritable: false },
        { pubkey: feeRecipient, isSigner: false, isWritable: true },
        { pubkey: mint, isSigner: false, isWritable: false },
        { pubkey: bondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
        { pubkey: associatedUser, isSigner: false, isWritable: true },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: systemProgram, isSigner: false, isWritable: false },
        { pubkey: rent, isSigner: false, isWritable: true },
        // { pubkey: associatedTokenProgram, isSigner: false, isWritable: false },
        { pubkey: tokenProgram, isSigner: false, isWritable: false },
        { pubkey: eventAuthority, isSigner: false, isWritable: false },
        { pubkey: programId, isSigner: false, isWritable: false },
    ];

    return new TransactionInstruction({
        keys,
        programId,
        data,
    });
}
