import { PublicKey } from "@solana/web3.js";
import BigNumber from "bignumber.js";

export interface PumpSwapPoolInfo {
    pool_bump: number;
    index: number;
    creator: PublicKey;
    base_mint: PublicKey;
    quote_mint: PublicKey;
    lp_mint: PublicKey;
    pool_base_token_account: PublicKey;
    pool_quote_token_account: PublicKey;
    lp_supply: BigNumber;
    coin_creator: PublicKey;
}


export interface PumpSwapAccount {
    inputMint: PublicKey;
    user: PublicKey;
}

export interface PumpSwapKeys {
    pool: PublicKey,
    user: PublicKey,
    globalConfig: PublicKey,
    baseMint: PublicKey,
    quoteMint: PublicKey,
    userBaseTokenAccount: PublicKey,
    userQuoteTokenAccount: PublicKey,
    poolBaseTokenAccount: PublicKey,
    poolQuoteTokenAccount: PublicKey,
    protocolFeeRecipient: PublicKey,
    protocolFeeRecipientTokenAccount: PublicKey,
    baseTokenProgram: PublicKey,
    quoteTokenProgram: PublicKey,
    systemProgram: PublicKey,
    associatedTokenProgram: PublicKey,
    eventAuthority: PublicKey,
    programId: PublicKey,
}