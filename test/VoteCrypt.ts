import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { VoteCrypt, VoteCrypt__factory } from "../types";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("VoteCrypt")) as VoteCrypt__factory;
  const contract = (await factory.deploy()) as VoteCrypt;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("VoteCrypt", function () {
  let signers: Signers;
  let contract: VoteCrypt;
  let contractAddress: string;

  before(async function () {
    const ethSigners = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("creates polls with encrypted zero tallies", async function () {
    const latest = await ethers.provider.getBlock("latest");
    const startTime = BigInt((latest?.timestamp ?? 0) + 1);
    const endTime = startTime + 3600n;

    await contract.createPoll("Favorite Color", ["Red", "Blue"], startTime, endTime);
    const count = await contract.getPollCount();
    expect(count).to.eq(1n);

    const [, options, recordedStart, recordedEnd, ended, resultsPublic] = await contract.getPoll(0);
    expect(options).to.deep.equal(["Red", "Blue"]);
    expect(recordedStart).to.eq(startTime);
    expect(recordedEnd).to.eq(endTime);
    expect(ended).to.eq(false);
    expect(resultsPublic).to.eq(false);

    const tallies = await contract.getEncryptedTallies(0);
    expect(tallies.length).to.eq(2);
  });

  it("tallies encrypted votes and reveals public counts", async function () {
    const latest = await ethers.provider.getBlock("latest");
    const startTime = BigInt((latest?.timestamp ?? 0) + 1);
    const endTime = startTime + 3600n;

    await contract.createPoll("Lunch", ["Pizza", "Sushi", "Burgers"], startTime, endTime);

    const activationTime = startTime + 1n;
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(activationTime)]);
    await ethers.provider.send("evm_mine", []);

    const pollId = 0;

    const aliceVote = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(1).encrypt();
    await contract.connect(signers.alice).vote(pollId, aliceVote.handles[0], aliceVote.inputProof);

    const bobVote = await fhevm.createEncryptedInput(contractAddress, signers.bob.address).add32(0).encrypt();
    await contract.connect(signers.bob).vote(pollId, bobVote.handles[0], bobVote.inputProof);

    await contract.endPoll(pollId);

    const tallies = await contract.getEncryptedTallies(pollId);
    expect(tallies.length).to.eq(3);

    const clearTallies = await Promise.all(
      tallies.map((tally) => fhevm.publicDecryptEuint(FhevmType.euint32, tally))
    );

    expect(clearTallies[0]).to.eq(1n);
    expect(clearTallies[1]).to.eq(1n);
    expect(clearTallies[2]).to.eq(0n);
  });

  it("prevents the same address from voting twice", async function () {
    const latest = await ethers.provider.getBlock("latest");
    const startTime = BigInt((latest?.timestamp ?? 0) + 1);
    const endTime = startTime + 3600n;
    await contract.createPoll("Snack", ["Chips", "Fruit"], startTime, endTime);

    const activationTime = startTime + 1n;
    await ethers.provider.send("evm_setNextBlockTimestamp", [Number(activationTime)]);
    await ethers.provider.send("evm_mine", []);

    const pollId = 0;
    const voteInput = await fhevm.createEncryptedInput(contractAddress, signers.alice.address).add32(0).encrypt();

    await contract.connect(signers.alice).vote(pollId, voteInput.handles[0], voteInput.inputProof);
    await expect(
      contract.connect(signers.alice).vote(pollId, voteInput.handles[0], voteInput.inputProof)
    ).to.be.revertedWith("Already voted");
  });
});
