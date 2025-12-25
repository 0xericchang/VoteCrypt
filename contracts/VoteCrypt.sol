// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title VoteCrypt - Encrypted poll manager using Zama FHE
/// @notice Allows anyone to create polls and collect encrypted votes. Results are revealed by making tallies publicly decryptable.
contract VoteCrypt is ZamaEthereumConfig {
    struct Poll {
        string name;
        string[] options;
        uint64 startTime;
        uint64 endTime;
        bool ended;
        bool resultsPublic;
        euint32[] tallies;
    }

    uint256 public pollCount;
    mapping(uint256 => Poll) private polls;
    mapping(uint256 => mapping(address => bool)) private hasVoted;

    event PollCreated(uint256 indexed pollId, string name, string[] options, uint64 startTime, uint64 endTime);
    event VoteSubmitted(uint256 indexed pollId, address indexed voter);
    event PollEnded(uint256 indexed pollId, uint64 endedAt);

    modifier validPoll(uint256 pollId) {
        require(pollId < pollCount, "Poll does not exist");
        _;
    }

    /// @notice Create a new poll with up to four options.
    /// @param name Name of the poll.
    /// @param options Option labels (2-4).
    /// @param startTime Timestamp when voting can begin.
    /// @param endTime Timestamp when voting is scheduled to close.
    /// @return pollId Newly created poll identifier.
    function createPoll(
        string memory name,
        string[] memory options,
        uint64 startTime,
        uint64 endTime
    ) external returns (uint256 pollId) {
        require(bytes(name).length > 0, "Poll name required");
        require(options.length >= 2 && options.length <= 4, "Options must be between 2 and 4");
        require(endTime > startTime, "End time must be after start");
        require(startTime >= block.timestamp, "Start time must not be in the past");

        for (uint256 i = 0; i < options.length; i++) {
            require(bytes(options[i]).length > 0, "Empty option not allowed");
        }

        pollId = pollCount;
        pollCount++;

        Poll storage poll = polls[pollId];
        poll.name = name;
        poll.startTime = startTime;
        poll.endTime = endTime;
        poll.options = options;

        for (uint256 i = 0; i < options.length; i++) {
            euint32 tally = FHE.asEuint32(0);
            poll.tallies.push(tally);
            FHE.allowThis(tally);
        }

        emit PollCreated(pollId, name, options, startTime, endTime);
    }

    /// @notice Cast an encrypted vote for a poll option.
    /// @param pollId The poll identifier.
    /// @param encryptedChoice Encrypted option index chosen by voter.
    /// @param inputProof Proof bound to the encrypted choice.
    function vote(
        uint256 pollId,
        externalEuint32 encryptedChoice,
        bytes calldata inputProof
    ) external validPoll(pollId) {
        Poll storage poll = polls[pollId];

        require(block.timestamp >= poll.startTime, "Poll not started");
        require(block.timestamp <= poll.endTime, "Voting closed");
        require(!poll.ended, "Poll ended");
        require(!hasVoted[pollId][msg.sender], "Already voted");

        euint32 choice = FHE.fromExternal(encryptedChoice, inputProof);
        uint256 optionCount = poll.options.length;

        for (uint256 i = 0; i < optionCount; i++) {
            ebool matches = FHE.eq(choice, uint32(i));
            euint32 increment = FHE.select(matches, FHE.asEuint32(1), FHE.asEuint32(0));
            poll.tallies[i] = FHE.add(poll.tallies[i], increment);
            FHE.allowThis(poll.tallies[i]);
        }

        hasVoted[pollId][msg.sender] = true;

        emit VoteSubmitted(pollId, msg.sender);
    }

    /// @notice Ends a poll and makes tallies publicly decryptable.
    /// @param pollId The poll identifier.
    function endPoll(uint256 pollId) external validPoll(pollId) {
        Poll storage poll = polls[pollId];
        require(!poll.ended, "Poll already ended");

        poll.ended = true;
        poll.resultsPublic = true;
        if (poll.endTime < block.timestamp) {
            poll.endTime = uint64(block.timestamp);
        }

        uint256 optionCount = poll.tallies.length;
        for (uint256 i = 0; i < optionCount; i++) {
            poll.tallies[i] = FHE.makePubliclyDecryptable(poll.tallies[i]);
        }

        emit PollEnded(pollId, uint64(block.timestamp));
    }

    /// @notice Returns the total number of polls created.
    function getPollCount() external view returns (uint256) {
        return pollCount;
    }

    /// @notice Returns metadata for a poll.
    /// @param pollId The poll identifier.
    function getPoll(
        uint256 pollId
    ) external view validPoll(pollId) returns (string memory, string[] memory, uint64, uint64, bool, bool) {
        Poll storage poll = polls[pollId];
        return (poll.name, poll.options, poll.startTime, poll.endTime, poll.ended, poll.resultsPublic);
    }

    /// @notice Returns encrypted tallies for a poll.
    /// @param pollId The poll identifier.
    function getEncryptedTallies(uint256 pollId) external view validPoll(pollId) returns (euint32[] memory) {
        return polls[pollId].tallies;
    }

    /// @notice Checks whether a given address has already voted.
    /// @param pollId The poll identifier.
    /// @param voter Address to check.
    function hasUserVoted(uint256 pollId, address voter) external view validPoll(pollId) returns (bool) {
        return hasVoted[pollId][voter];
    }
}
