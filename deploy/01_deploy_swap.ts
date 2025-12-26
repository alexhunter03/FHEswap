import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  const usdc = await get("ERC7984USDC");
  const zama = await get("ERC7984Zama");

  const swap = await deploy("FHESwap", {
    from: deployer,
    args: [usdc.address, zama.address],
    gasLimit: 12_000_000,
    log: true,
  });

  console.log(`FHESwap: ${swap.address}`);
};

export default func;
func.id = "deploy_swap";
func.tags = ["FHESwap"];
func.dependencies = ["Tokens"];
