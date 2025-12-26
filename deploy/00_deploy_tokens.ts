import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const usdc = await deploy("ERC7984USDC", {
    from: deployer,
    log: true,
  });

  const zama = await deploy("ERC7984Zama", {
    from: deployer,
    log: true,
  });

  console.log(`ERC7984USDC: ${usdc.address}`);
  console.log(`ERC7984Zama: ${zama.address}`);
};

export default func;
func.id = "deploy_tokens";
func.tags = ["Tokens"];

