import { PublicKey } from "@solana/web3.js";

export interface PumpSwapPoolInfo {
    pool_bump: number;
    index: number;
    creator: PublicKey;
    base_mint: PublicKey;
    quote_mint: PublicKey;
    lp_mint: PublicKey;
    pool_base_token_account: PublicKey;
    pool_quote_token_account: PublicKey;
    lp_supply: bigint;
}


export interface PumpSwapAccount {
    inputMint : PublicKey;
    pool : PublicKey;
    baseMint : PublicKey;
    quoteMint : PublicKey;
    baseTokenProgram : PublicKey;
    quoteTokenProgram : PublicKey;
    user : PublicKey;
}