import { useEffect, useMemo, useState } from 'react';
import type { Poll } from './pollTypes';
import '../styles/VoteApp.css';

type PollDetailsProps = {
  poll: Poll | null;
  decryptedTallies?: number[];
  onVote: (pollId: number, choiceIndex: number) => Promise<void>;
  onEndPoll: (pollId: number) => Promise<void>;
  onDecrypt: (pollId: number) => Promise<void>;
  isVoting: boolean;
  isEnding: boolean;
  isDecrypting: boolean;
  zamaReady: boolean;
  address?: string;
};

const formatTime = (timestamp: bigint) => {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString();
};

export function PollDetails({
  poll,
  decryptedTallies,
  onVote,
  onEndPoll,
  onDecrypt,
  isVoting,
  isEnding,
  isDecrypting,
  zamaReady,
  address,
}: PollDetailsProps) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  useEffect(() => {
    setSelectedChoice(null);
  }, [poll?.id]);

  const status = useMemo(() => {
    if (!poll) return { label: 'Pick a poll', tone: 'muted' };
    const now = Date.now() / 1000;
    if (poll.ended) return { label: 'Ended', tone: 'ended' };
    if (now < Number(poll.startTime)) return { label: 'Upcoming', tone: 'upcoming' };
    if (now > Number(poll.endTime)) return { label: 'Ready to reveal', tone: 'ready' };
    return { label: 'Live', tone: 'live' };
  }, [poll]);

  if (!poll) {
    return (
      <div className="card">
        <p className="muted">Select a poll to view details and vote.</p>
      </div>
    );
  }

  const canVote =
    status.label === 'Live' && !poll.hasVoted && zamaReady && !isVoting && Boolean(address);
  const actionLabel = isVoting ? 'Submitting vote...' : poll.hasVoted ? 'You already voted' : 'Submit encrypted vote';

  const showDecrypted = decryptedTallies && decryptedTallies.length === poll.options.length;
  const totalVotes = showDecrypted ? decryptedTallies.reduce((acc, v) => acc + v, 0) : 0;

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Poll #{poll.id}</p>
          <h2 className="card-title">{poll.name}</h2>
          <p className="card-subtitle">
            Opens {formatTime(poll.startTime)} • Closes {formatTime(poll.endTime)}
          </p>
        </div>
        <span className={`status-badge ${status.tone}`}>{status.label}</span>
      </div>

      <div className="options-stack">
        {poll.options.map((option, index) => {
          const tally = showDecrypted ? decryptedTallies?.[index] ?? 0 : null;
          const width = tally !== null && totalVotes > 0 ? Math.round((tally / totalVotes) * 100) : 0;

          return (
            <label key={index} className={`option-card ${selectedChoice === index ? 'active' : ''}`}>
              <div className="option-head">
                <div className="option-name">
                  <input
                    type="radio"
                    name="choice"
                    value={index}
                    onChange={() => setSelectedChoice(index)}
                    disabled={!canVote}
                    checked={selectedChoice === index}
                  />
                  <span>{option}</span>
                </div>
                {tally !== null && (
                  <span className="pill">
                    {tally} vote{tally === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {tally !== null && (
                <div className="progress">
                  <div className="progress-bar" style={{ width: `${width}%` }} />
                </div>
              )}
            </label>
          );
        })}
      </div>

      <div className="actions-row">
        <button
          className="primary-button"
          onClick={() => selectedChoice !== null && onVote(poll.id, selectedChoice)}
          disabled={!canVote || selectedChoice === null}
        >
          {actionLabel}
        </button>
        {!poll.ended && (
          <button className="ghost-button" onClick={() => onEndPoll(poll.id)} disabled={isEnding}>
            {isEnding ? 'Ending...' : 'End poll & reveal'}
          </button>
        )}
        {poll.resultsPublic && (
          <button className="pill-button" onClick={() => onDecrypt(poll.id)} disabled={isDecrypting}>
            {isDecrypting ? 'Decrypting...' : 'Decrypt public results'}
          </button>
        )}
      </div>

      {!zamaReady && (
        <p className="muted">
          Encryption tools are still loading. Keep this tab open while the Zama SDK initializes.
        </p>
      )}
      {!address && <p className="muted">Connect your wallet to cast a vote.</p>}
    </div>
  );
}
