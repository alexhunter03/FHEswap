# FHEswap

FHEswap is a privacy-preserving swap demo built on Zama's FHEVM. It pairs two
confidential ERC-7984 tokens (fUSDC and fZama) and lets users add liquidity,
swap in both directions, and decrypt their balances only when they choose.

This repository contains:
- Solidity contracts that handle confidential balances and swaps.
- Hardhat deployment and task scripts for local and Sepolia workflows.
- A React + Vite frontend (in `app/`) that reads with viem and writes with ethers.

## Table of Contents
- Project Overview
- Problems Solved
- Advantages
- Core Features
- Architecture Overview
- Technology Stack
- Project Structure
- Configuration
- Installation
- Local Development
- Deployment (Local and Sepolia)
- Frontend Usage
- Tasks and Scripts
- Testing
- Security and Privacy Notes
- Known Limitations
- Roadmap
- License

## Project Overview
FHEswap demonstrates how Fully Homomorphic Encryption can enable private DeFi
flows. Token balances, amounts, and pool reserves are stored as encrypted values
on-chain, while users can still execute swaps and liquidity actions. The swap
logic uses a fixed 1 fZama = 2 fUSDC price relationship with a 0.3% fee and caps
output by available reserves to prevent underflow.

## Problems Solved
- Protecting user balances and swap amounts from public on-chain visibility.
- Demonstrating encrypted token transfers using ERC-7984 primitives.
- Providing a full flow from encrypted minting to swaps and balance decryption.
- Showing how a frontend can decrypt balances only with user consent.

## Advantages
- Privacy-first UX: balances and swap amounts are encrypted by default.
- User-controlled decryption: no plaintext state is exposed without permission.
- Clear separation of read vs write providers (viem reads, ethers writes).
- Deployable to Sepolia with a deterministic seed to bootstrap the pool.
- End-to-end reference for building FHE dApps with Zama's stack.

## Core Features
- Confidential tokens: `ERC7984USDC` and `ERC7984Zama` with encrypted balances.
- Liquidity addition with encrypted amounts.
- Swaps in both directions with a fixed 1:2 price ratio and a 0.3% fee.
- Reserve decryption through explicit `allowReserves` permissioning.
- Frontend balance decryption via the Zama relayer SDK.
- Faucet-style minting for testing.

## Architecture Overview
### Smart Contracts
- `ERC7984USDC` and `ERC7984Zama`
  - ERC-7984 confidential tokens.
  - `mint(address,uint64)` mints encrypted balances for testing.
- `FHESwap`
  - Holds encrypted reserves for fUSDC and fZama.
  - `addLiquidity` accepts encrypted inputs and updates reserves.
  - `swapUSDCForZama` and `swapZamaForUSDC` perform swaps with a 0.3% fee.
  - Uses a fixed 1:2 price relationship and caps output by available reserves.
  - `getReserves` returns encrypted reserves, and `allowReserves` grants a user
    permission to decrypt those reserves.

### Deployments
Deployment scripts in `deploy/` follow a deterministic flow:
1. Deploy fUSDC and fZama tokens.
2. Deploy the swap contract.
3. Seed the pool at 1 fZama = 2 fUSDC and sync frontend ABIs for Sepolia.

### Frontend
The frontend in `app/`:
- Reads encrypted balances with viem.
- Sends encrypted transactions with ethers + Zama relayer SDK.
- Uses RainbowKit and wagmi for wallet connectivity.
- Runs against Sepolia only (no localhost usage in the UI).
- Avoids frontend environment variables by pulling addresses and ABIs from
  `app/src/config/contracts.ts`.

## Technology Stack
### On-chain
- Solidity 0.8.27
- Hardhat + hardhat-deploy
- Zama FHEVM Solidity library
- OpenZeppelin confidential-contracts (ERC-7984)
- TypeChain (ethers v6 target)

### Frontend
- React 19 + TypeScript + Vite
- viem (read-only calls)
- ethers v6 (write calls)
- RainbowKit + wagmi
- @zama-fhe/relayer-sdk
- @tanstack/react-query

### Tooling
- ESLint + Prettier
- Hardhat gas reporter (optional)
- Mocha + Chai tests

## Project Structure
```
contracts/          Solidity contracts (fUSDC, fZama, FHESwap)
deploy/             Deployment scripts (tokens, swap, seed)
tasks/              Hardhat tasks for addresses, seeding, and reserve decryption
test/               Hardhat tests
deployments/        Deployment artifacts and ABIs
app/                React + Vite frontend
docs/               Zama documentation references
```

## Configuration
Create a root `.env` file for deployment to Sepolia:
```
INFURA_API_KEY=your_infura_api_key
PRIVATE_KEY=your_wallet_private_key
ETHERSCAN_API_KEY=optional_for_verification
```
Notes:
- Deployment uses `PRIVATE_KEY` only (no mnemonic support).
- The frontend does not use environment variables.

## Installation
```
npm install
```
For the frontend:
```
cd app
npm install
```

## Local Development
Compile and run tests:
```
npm run compile
npm run test
```

Start a local node and deploy:
```
npm run chain
npm run deploy:localhost
```

## Deployment (Local and Sepolia)
Deploy all contracts:
```
npm run deploy:localhost
npm run deploy:sepolia
```

Seed the liquidity pool (also syncs frontend ABIs on Sepolia):
```
npx hardhat deploy --tags Seed --network localhost
npx hardhat deploy --tags Seed --network sepolia
```

Verify on Sepolia (optional):
```
npm run verify:sepolia -- <CONTRACT_ADDRESS>
```

## Frontend Usage
Run the frontend:
```
cd app
npm run dev
```

Workflow in the UI:
1. Connect a Sepolia wallet.
2. Refresh encrypted balances.
3. Decrypt balances via the relayer flow.
4. Authorize the swap contract as operator for both tokens.
5. Mint test tokens (fUSDC and fZama).
6. Add liquidity using the suggested 1 fZama = 2 fUSDC ratio.
7. Execute swaps and observe balance changes after decryption.

## Tasks and Scripts
Useful Hardhat tasks:
```
npx hardhat task:swap:addresses --network sepolia
npx hardhat task:swap:seed --network sepolia
npx hardhat task:swap:decrypt-reserves --network sepolia
```

## Testing
- `test/FHESwap.ts` validates encrypted liquidity and swap flows.
- Tests run against the FHEVM mock network and are skipped on Sepolia.

## Security and Privacy Notes
- This project is a demo and has not been audited.
- Confidential values are represented by encrypted handles and require explicit
  allowlists for decryption.
- Only the user holding the decryption key can reveal balances.
- The swap formula is fixed-ratio with a fee and does not implement an x*y=k AMM.

## Known Limitations
- No LP token issuance or liquidity removal flow.
- No dynamic pricing or slippage protection beyond reserve caps.
- Token minting is unrestricted and intended only for test use.
- No on-chain price oracle or volatility management.

## Roadmap
- Add Uniswap V2-style constant-product pricing and LP tokens.
- Enable liquidity removal and fee accounting for LPs.
- Add encrypted price oracles and configurable fees.
- Expand to multiple pools and token pairs.
- Improve frontend analytics (TVL, volume, swap history).
- Formal security audit and gas optimizations.

## License
BSD-3-Clause-Clear. See `LICENSE`.
