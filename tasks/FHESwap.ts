import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:swap:addresses", "Print FHESwap, fUSDC, fZama addresses").setAction(async function (_: TaskArguments, hre) {
  const { deployments } = hre;

  const usdc = await deployments.get("ERC7984USDC");
  const zama = await deployments.get("ERC7984Zama");
  const swap = await deployments.get("FHESwap");

  console.log(`ERC7984USDC: ${usdc.address}`);
  console.log(`ERC7984Zama: ${zama.address}`);
  console.log(`FHESwap    : ${swap.address}`);
});

task("task:swap:seed", "Mint tokens and seed the pool at 1 fZama = 2 fUSDC")
  .addOptionalParam("usdc", "Initial fUSDC liquidity", "2000")
  .addOptionalParam("zama", "Initial fZama liquidity", "1000")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    const usdcAmount = BigInt(taskArguments.usdc);
    const zamaAmount = BigInt(taskArguments.zama);
    if (usdcAmount !== zamaAmount * 2n) {
      throw new Error(`Expected usdc == 2 * zama (got usdc=${usdcAmount} zama=${zamaAmount})`);
    }

    await fhevm.initializeCLIApi();

    const [signer] = await ethers.getSigners();

    const usdcDeployment = await deployments.get("ERC7984USDC");
    const zamaDeployment = await deployments.get("ERC7984Zama");
    const swapDeployment = await deployments.get("FHESwap");

    const usdc = await ethers.getContractAt("ERC7984USDC", usdcDeployment.address);
    const zama = await ethers.getContractAt("ERC7984Zama", zamaDeployment.address);
    const swap = await ethers.getContractAt("FHESwap", swapDeployment.address);

    await (await usdc.connect(signer).mint(signer.address, 100_000)).wait();
    await (await zama.connect(signer).mint(signer.address, 100_000)).wait();

    const until = 2 ** 32;
    await (await usdc.connect(signer).setOperator(swapDeployment.address, until)).wait();
    await (await zama.connect(signer).setOperator(swapDeployment.address, until)).wait();

    const encrypted = await fhevm
      .createEncryptedInput(swapDeployment.address, signer.address)
      .add64(usdcAmount)
      .add64(zamaAmount)
      .encrypt();

    const tx = await swap.connect(signer).addLiquidity(encrypted.handles[0], encrypted.handles[1], encrypted.inputProof);
    console.log(`Wait for tx:${tx.hash}...`);
    await tx.wait();
    console.log(`Seeded FHESwap with usdc=${usdcAmount} zama=${zamaAmount}`);
  });

task("task:swap:decrypt-reserves", "Decrypt FHESwap reserves")
  .addOptionalParam("address", "Optionally specify the FHESwap address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const [signer] = await ethers.getSigners();

    const swapDeployment = taskArguments.address ? { address: taskArguments.address } : await deployments.get("FHESwap");
    const swap = await ethers.getContractAt("FHESwap", swapDeployment.address);

    await (await swap.connect(signer).allowReserves(signer.address)).wait();
    const [encReserveUSDC, encReserveZama] = await swap.getReserves();

    const reserveUSDC = await fhevm.userDecryptEuint(FhevmType.euint64, encReserveUSDC, swapDeployment.address, signer);
    const reserveZama = await fhevm.userDecryptEuint(FhevmType.euint64, encReserveZama, swapDeployment.address, signer);

    console.log(`Reserves: fUSDC=${reserveUSDC} fZama=${reserveZama}`);
  });

