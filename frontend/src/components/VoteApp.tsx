import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { Contract } from 'ethers';
import { Header } from './Header';
import { CreatePollForm } from './CreatePollForm';
import { PollList } from './PollList';
import { PollDetails } from './PollDetails';
import type { CreatePollPayload } from './CreatePollForm';
import type { Poll } from './pollTypes';
import { CONTRACT_ABI, CONTRACT_ADDRESS } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';
import '../styles/VoteApp.css';

type TalliesState = Record<number, number[]>;

export function VoteApp() {
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signer = useEthersSigner();

  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<number | null>(null);
  const [loadingPolls, setLoadingPolls] = useState(false);
  const [creating, setCreating] = useState(false);
  const [voteBusy, setVoteBusy] = useState<number | null>(null);
  const [endingPollId, setEndingPollId] = useState<number | null>(null);
  const [decryptingPollId, setDecryptingPollId] = useState<number | null>(null);
  const [decryptedTallies, setDecryptedTallies] = useState<TalliesState>({});
  const [message, setMessage] = useState<string | null>(null);

  const zamaReady = useMemo(() => Boolean(instance) && !zamaLoading, [instance, zamaLoading]);

  const fetchPolls = useCallback(async () => {
    if (!publicClient) return;
    setLoadingPolls(true);
    try {


      const count = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getPollCount',
      })) as bigint;

      const next: Poll[] = [];
      for (let i = 0; i < Number(count); i++) {
        const [name, options, startTime, endTime, ended, resultsPublic] = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: 'getPoll',
          args: [BigInt(i)],
        })) as [string, string[], bigint, bigint, boolean, boolean];

        const hasVoted = address
          ? ((await publicClient.readContract({
              address: CONTRACT_ADDRESS,
              abi: CONTRACT_ABI,
              functionName: 'hasUserVoted',
              args: [BigInt(i), address],
            })) as boolean)
          : false;

        next.push({
          id: i,
          name,
          options,
          startTime,
          endTime,
          ended,
          resultsPublic,
          hasVoted,
        });
      }

      setPolls(next);
      if (selectedPollId === null && next.length > 0) {
        setSelectedPollId(next[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch polls', error);
      setMessage('Unable to load polls. Check your connection to Sepolia.');
    } finally {
      setLoadingPolls(false);
    }
  }, [address, publicClient, selectedPollId]);

  useEffect(() => {
    fetchPolls();
  }, [fetchPolls]);

  const handleCreatePoll = async (payload: CreatePollPayload) => {
    if (!signer) {
      setMessage('Connect your wallet to publish polls.');
      return;
    }

    setCreating(true);
    setMessage(null);
    try {
      const resolvedSigner = await signer;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.createPoll(
        payload.name,
        payload.options,
        BigInt(payload.startTime),
        BigInt(payload.endTime)
      );
      setMessage('Publishing poll to the network...');
      await tx.wait();
      await fetchPolls();
      setMessage('Poll created successfully.');
    } catch (error) {
      console.error('Failed to create poll', error);
      setMessage('Failed to create poll. Ensure times are valid and try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (pollId: number, choice: number) => {
    if (!instance || !address || !signer) {
      setMessage('Connect your wallet and wait for the Zama SDK to be ready.');
      return;
    }

    setVoteBusy(pollId);
    setMessage(null);
    try {
      const encryptedInput = await instance.createEncryptedInput(CONTRACT_ADDRESS, address).add32(choice).encrypt();
      const resolvedSigner = await signer;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.vote(BigInt(pollId), encryptedInput.handles[0], encryptedInput.inputProof);
      setMessage('Submitting your encrypted vote...');
      await tx.wait();
      setMessage('Vote submitted.');
      setDecryptedTallies((prev) => {
        const next = { ...prev };
        delete next[pollId];
        return next;
      });
      await fetchPolls();
    } catch (error) {
      console.error('Failed to vote', error);
      setMessage('Vote failed. Ensure the poll is live and try again.');
    } finally {
      setVoteBusy(null);
    }
  };

  const handleEndPoll = async (pollId: number) => {
    if (!signer) {
      setMessage('Connect your wallet to end a poll.');
      return;
    }

    setEndingPollId(pollId);
    setMessage(null);
    try {
      const resolvedSigner = await signer;
      const contract = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, resolvedSigner);
      const tx = await contract.endPoll(BigInt(pollId));
      setMessage('Ending poll and making tallies public...');
      await tx.wait();
      await fetchPolls();
      setMessage('Poll closed. Results are now public.');
    } catch (error) {
      console.error('Failed to end poll', error);
      setMessage('Unable to end poll right now.');
    } finally {
      setEndingPollId(null);
    }
  };

  const handleDecrypt = async (pollId: number) => {
    if (!instance || !publicClient) {
      setMessage('Encryption tools not ready yet.');
      return;
    }

    setDecryptingPollId(pollId);
    setMessage(null);
    try {
      const encryptedTallies = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getEncryptedTallies',
        args: [BigInt(pollId)],
      })) as string[];

      const result = await instance.publicDecrypt(encryptedTallies);
      const clearValues = encryptedTallies.map((handle) => {
        const value = result.clearValues[handle];
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'number') return value;
        const parsed = typeof value === 'string' ? Number(value) : 0;
        return Number.isNaN(parsed) ? 0 : parsed;
      });

      setDecryptedTallies((prev) => ({ ...prev, [pollId]: clearValues }));
      setMessage('Results decrypted from the public tally.');
    } catch (error) {
      console.error('Failed to decrypt tallies', error);
      setMessage('Decryption failed. Ensure the poll has been ended.');
    } finally {
      setDecryptingPollId(null);
    }
  };

  const selectedPoll = polls.find((poll) => poll.id === selectedPollId) || null;

  return (
    <div className="page">
      <Header />
      <main className="layout">
        <section className="lead">
          <h1>VoteCrypt</h1>
          <p>
            Create privacy-first polls, encrypt every ballot with Zama FHE, and reveal public tallies only when the
            community is ready.
          </p>
          {message && <div className="banner">{message}</div>}
          {zamaError && <div className="banner error">Zama SDK error: {zamaError}</div>}
        </section>

        <section className="grid">
          <CreatePollForm onCreate={handleCreatePoll} isSubmitting={creating} />
          <PollList
            polls={polls}
            selectedId={selectedPollId}
            onSelect={setSelectedPollId}
            loading={loadingPolls}
            onRefresh={fetchPolls}
          />
        </section>

        <section className="grid single">
          <PollDetails
            poll={selectedPoll}
            decryptedTallies={selectedPoll ? decryptedTallies[selectedPoll.id] : undefined}
            onVote={handleVote}
            onEndPoll={handleEndPoll}
            onDecrypt={handleDecrypt}
            isVoting={voteBusy === selectedPoll?.id}
            isEnding={endingPollId === selectedPoll?.id}
            isDecrypting={decryptingPollId === selectedPoll?.id}
            zamaReady={zamaReady}
            address={address}
          />
        </section>
      </main>
    </div>
  );
}
