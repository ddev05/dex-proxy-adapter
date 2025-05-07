// import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
// import { PoolReserves } from "../types";
// import { IDexReadAdapter } from "../utils/iAdapter";
// import { AccountLayout , Account } from "@solana/spl-token";

// export class RaydiumV4Adapter implements IDexReadAdapter {

//     async getPoolKeys(connection: Connection, poolAddress: String): Promise<AmmInfo | null> {
//         const poolId = new PublicKey(poolAddress);
//         const data = await connection.getAccountInfo(poolId)
//         if (data) {
//             return parseAmmInfo(data.data)
//         } else {
//             return null
//         }
//     }

//     async getPoolReserves(connection: Connection, baseVault: string, quoteVault: string): Promise<PoolReserves> {
//         const [baseVaultData, quoteVaultData] =
//             await connection.getMultipleAccountsInfo([new PublicKey(baseVault), new PublicKey(quoteVault)]);

//         if (baseVaultData && quoteVaultData) {
//             const { amount: baseVaultReserve } = AccountLayout.decode(baseVaultData.data)
//             const { amount: quoteVaultReserve } = AccountLayout.decode(quoteVaultData.data)

//             return {
//                 reserveToken0: Number(baseVaultReserve),
//                 reserveToken1: Number(quoteVaultReserve),
//             }
//         } else {
//             return {
//                 reserveToken0: 0,
//                 reserveToken1: 0,
//             }
//         }
//     }
//     async getPrice(reserveBase: number, reserveQuote: number): Promise<number> {
        
//     }

//     async getSwapQuote(inputMint: string, inputAmount: number): Promise<number> {
//         return inputAmount * 0.98;
//     }

//     async swap(inputMint: string): Promise<TransactionInstruction> {
//         throw new Error("Swap not implemented yet");
//     }
// }