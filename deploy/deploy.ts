import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedVoteCrypt = await deploy("VoteCrypt", {
    from: deployer,
    log: true,
  });

  console.log(`VoteCrypt contract: `, deployedVoteCrypt.address);
};
export default func;
func.id = "deploy_voteCrypt"; // id required to prevent reexecution
func.tags = ["VoteCrypt"];
