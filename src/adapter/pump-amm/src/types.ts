import { PublicKey } from "@solana/web3.js";

export interface Pool {
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


export interface GlobalConfig {
    admin: PublicKey;
    lp_fee_basis_points: bigint;
    protocol_fee_basis_points: bigint;
    disable_flags: number;
    protocol_fee_recipients: PublicKey[];
}