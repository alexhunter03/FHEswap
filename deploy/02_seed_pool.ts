import { FhevmType } from "@fhevm/hardhat-plugin";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import fs from "fs";
import path from "path";

const INITIAL_ZAMA = 1_000n;
const INITIAL_USDC = 2_000n;

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { ethers, deployments, fhevm } = hre;

  await fhevm.initializeCLIApi();

  const usdcDeployment = await deployments.get("ERC7984USDC");
  const zamaDeployment = await deployments.get("ERC7984Zama");
  const swapDeployment = await deployments.get("FHESwap");

  const signer = await ethers.getSigner(deployer);

  const usdc = await ethers.getContractAt("ERC7984USDC", usdcDeployment.address, signer);
  const zama = await ethers.getContractAt("ERC7984Zama", zamaDeployment.address, signer);
  const swap = await ethers.getContractAt("FHESwap", swapDeployment.address, signer);

  await (await usdc.mint(deployer, 100_000)).wait();
  await (await zama.mint(deployer, 100_000)).wait();

  const until = 2 ** 32;
  await (await usdc.setOperator(swapDeployment.address, until)).wait();
  await (await zama.setOperator(swapDeployment.address, until)).wait();

  const encrypted = await fhevm
    .createEncryptedInput(swapDeployment.address, deployer)
    .add64(INITIAL_USDC)
    .add64(INITIAL_ZAMA)
    .encrypt();

  const tx = await swap.addLiquidity(encrypted.handles[0], encrypted.handles[1], encrypted.inputProof);
  await tx.wait();

  await swap.allowReserves(deployer);
  const [encReserveUSDC, encReserveZama] = await swap.getReserves();
  const clearReserveUSDC = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    encReserveUSDC,
    swapDeployment.address,
    signer,
  );
  const clearReserveZama = await fhevm.userDecryptEuint(
    FhevmType.euint64,
    encReserveZama,
    swapDeployment.address,
    signer,
  );

  console.log(`Seeded pool reserves: fUSDC=${clearReserveUSDC} fZama=${clearReserveZama}`);

  if (hre.network.name === "sepolia") {
    const outPath = path.join(process.cwd(), "app", "src", "config", "contracts.ts");
    const contents =
      `// Auto-generated from deployments/sepolia. Do not edit manually.\n` +
      `export const FUSDC_ADDRESS = '${usdcDeployment.address}' as const;\n` +
      `export const FZAMA_ADDRESS = '${zamaDeployment.address}' as const;\n` +
      `export const SWAP_ADDRESS = '${swapDeployment.address}' as const;\n\n` +
      `export const FUSDC_ABI = ${JSON.stringify(usdcDeployment.abi, null, 2)} as const;\n\n` +
      `export const FZAMA_ABI = ${JSON.stringify(zamaDeployment.abi, null, 2)} as const;\n\n` +
      `export const SWAP_ABI = ${JSON.stringify(swapDeployment.abi, null, 2)} as const;\n`;

    fs.writeFileSync(outPath, contents, "utf8");
    console.log(`Synced frontend config: ${outPath}`);
  }
};

export default func;
func.id = "seed_pool";
func.tags = ["Seed"];
func.dependencies = ["FHESwap"];
func.skip = async (hre: HardhatRuntimeEnvironment) => {
  return hre.network.name !== "localhost" && hre.network.name !== "sepolia";
};
