import { useMemo, useState } from 'react';
import '../styles/VoteApp.css';

export type CreatePollPayload = {
  name: string;
  options: string[];
  startTime: number;
  endTime: number;
};

type CreatePollFormProps = {
  onCreate: (payload: CreatePollPayload) => Promise<void>;
  isSubmitting: boolean;
};

const toDateTimeLocal = (timestamp: number) => {
  const date = new Date(timestamp);
  const iso = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
  return iso.slice(0, 16);
};

export function CreatePollForm({ onCreate, isSubmitting }: CreatePollFormProps) {
  const now = useMemo(() => Date.now(), []);
  const [name, setName] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [startAt, setStartAt] = useState(toDateTimeLocal(now + 5 * 60 * 1000));
  const [endAt, setEndAt] = useState(toDateTimeLocal(now + 65 * 60 * 1000));
  const [error, setError] = useState<string | null>(null);

  const handleOptionChange = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const addOption = () => {
    if (options.length >= 4) return;
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    const next = options.filter((_, i) => i !== index);
    setOptions(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean);
    if (trimmedOptions.length < 2 || trimmedOptions.length > 4) {
      setError('Please provide between two and four options.');
      return;
    }

    const startSeconds = Math.floor(new Date(startAt).getTime() / 1000);
    const endSeconds = Math.floor(new Date(endAt).getTime() / 1000);

    if (!name.trim()) {
      setError('Give your poll a name.');
      return;
    }

    if (Number.isNaN(startSeconds) || Number.isNaN(endSeconds)) {
      setError('Provide valid start and end times.');
      return;
    }

    if (endSeconds <= startSeconds) {
      setError('End time must be after start time.');
      return;
    }

    await onCreate({
      name: name.trim(),
      options: trimmedOptions,
      startTime: startSeconds,
      endTime: endSeconds,
    });

    setName('');
    setOptions(['', '']);
    const refreshNow = Date.now();
    setStartAt(toDateTimeLocal(refreshNow + 5 * 60 * 1000));
    setEndAt(toDateTimeLocal(refreshNow + 65 * 60 * 1000));
  };

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <p className="eyebrow">Create Poll</p>
          <h2 className="card-title">Launch a fresh encrypted vote</h2>
          <p className="card-subtitle">
            Define the question, pick up to four options, and set when voting opens and closes.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-grid">
        <label className="field">
          <span className="field-label">Title</span>
          <input
            type="text"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Choose the next feature to ship"
            required
          />
        </label>

        <div className="field">
          <span className="field-label">Options</span>
          <div className="options-grid">
            {options.map((opt, index) => (
              <div key={index} className="option-row">
                <input
                  type="text"
                  className="input"
                  value={opt}
                  placeholder={`Option ${index + 1}`}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  required
                />
                {options.length > 2 && (
                  <button type="button" className="ghost-button" onClick={() => removeOption(index)}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="option-actions">
            <button type="button" className="pill-button" onClick={addOption} disabled={options.length >= 4}>
              + Add option
            </button>
            <span className="hint">{options.length}/4 options</span>
          </div>
        </div>

        <div className="time-grid">
          <label className="field">
            <span className="field-label">Starts</span>
            <input
              type="datetime-local"
              className="input"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field-label">Ends</span>
            <input
              type="datetime-local"
              className="input"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
            />
          </label>
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" className="primary-button" disabled={isSubmitting}>
          {isSubmitting ? 'Publishing...' : 'Publish poll'}
        </button>
      </form>
    </div>
  );
}
