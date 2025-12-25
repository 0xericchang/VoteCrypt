import type { Poll } from './pollTypes';
import '../styles/VoteApp.css';

type PollListProps = {
  polls: Poll[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  loading: boolean;
  onRefresh: () => void;
};

const formatTime = (timestamp: bigint) => {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleString();
};

const pollStatus = (poll: Poll) => {
  const now = Date.now() / 1000;
  if (poll.ended) return { label: 'Ended', tone: 'ended' };
  if (now < Number(poll.startTime)) return { label: 'Upcoming', tone: 'upcoming' };
  if (now > Number(poll.endTime)) return { label: 'Ready to reveal', tone: 'ready' };
  return { label: 'Live', tone: 'live' };
};

export function PollList({ polls, selectedId, onSelect, loading, onRefresh }: PollListProps) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Polls</p>
          <h2 className="card-title">Encrypted votes in progress</h2>
        </div>
        <button className="ghost-button" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div className="poll-list">
        {polls.length === 0 && !loading && <p className="muted">No polls yet. Start one to kick things off.</p>}
        {polls.map((poll) => {
          const status = pollStatus(poll);
          return (
            <button
              key={poll.id}
              className={`poll-tile ${selectedId === poll.id ? 'selected' : ''}`}
              onClick={() => onSelect(poll.id)}
            >
              <div className="poll-tile-header">
                <span className={`status-badge ${status.tone}`}>{status.label}</span>
                {poll.resultsPublic && <span className="status-badge public">Public results</span>}
              </div>
              <h3 className="poll-name">{poll.name}</h3>
              <p className="poll-meta">
                Options: {poll.options.length} • Opens {formatTime(poll.startTime)} • Closes {formatTime(poll.endTime)}
              </p>
              <div className="poll-actions">
                <span className="pill">Voted: {poll.hasVoted ? 'Yes' : 'No'}</span>
                <span className="pill subtle">#{poll.id}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
