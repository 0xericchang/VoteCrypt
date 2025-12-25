import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:votecrypt:address", "Prints the VoteCrypt address").setAction(async function (_taskArguments: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get("VoteCrypt");
  console.log("VoteCrypt address:", deployment.address);
});

task("task:votecrypt:create", "Creates a new poll")
  .addParam("name", "Name of the poll")
  .addParam("options", "Comma separated option list (2-4 options)")
  .addOptionalParam("start", "Start timestamp (defaults to now + 60s)")
  .addOptionalParam("end", "End timestamp (defaults to start + 1 hour)")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const deployment = await deployments.get("VoteCrypt");
    const contract = await ethers.getContractAt("VoteCrypt", deployment.address);

    const options = (taskArguments.options as string).split(",").map((opt) => opt.trim());
    if (options.length < 2 || options.length > 4) {
      throw new Error("Options must contain between 2 and 4 entries");
    }

    const startTs =
      taskArguments.start !== undefined ? BigInt(taskArguments.start as string) : BigInt(Math.floor(Date.now() / 1000 + 60));
    const endTs =
      taskArguments.end !== undefined ? BigInt(taskArguments.end as string) : startTs + BigInt(3600);

    const tx = await contract.connect(signer).createPoll(taskArguments.name as string, options, startTs, endTs);
    console.log(`Creating poll '${taskArguments.name}'... tx: ${tx.hash}`);
    await tx.wait();
    console.log("Poll created");
  });

task("task:votecrypt:vote", "Casts an encrypted vote for a poll")
  .addParam("poll", "Poll id")
  .addParam("choice", "Option index to vote for")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const pollId = Number(taskArguments.poll);
    const choice = Number(taskArguments.choice);
    const deployment = await deployments.get("VoteCrypt");
    const contract = await ethers.getContractAt("VoteCrypt", deployment.address);
    const signer = (await ethers.getSigners())[0];

    const encryptedInput = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add32(choice)
      .encrypt();

    const tx = await contract
      .connect(signer)
      .vote(pollId, encryptedInput.handles[0], encryptedInput.inputProof);

    console.log(`Voting on poll #${pollId} with option ${choice}. tx: ${tx.hash}`);
    await tx.wait();
    console.log("Vote submitted");
  });

task("task:votecrypt:decrypt", "Decrypts public tallies for a poll")
  .addParam("poll", "Poll id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers, fhevm } = hre;
    await fhevm.initializeCLIApi();

    const pollId = Number(taskArguments.poll);
    const deployment = await deployments.get("VoteCrypt");
    const contract = await ethers.getContractAt("VoteCrypt", deployment.address);
    const signer = (await ethers.getSigners())[0];

    const tallies = await contract.getEncryptedTallies(pollId);
    console.log(`Tallies for poll #${pollId}:`);
    for (let i = 0; i < tallies.length; i++) {
      const clear = await fhevm.publicDecryptEuint(FhevmType.euint32, tallies[i]);
      console.log(` - Option ${i}: ${clear.toString()}`);
    }
  });
