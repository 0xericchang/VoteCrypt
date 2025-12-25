export type Poll = {
  id: number;
  name: string;
  options: string[];
  startTime: bigint;
  endTime: bigint;
  ended: boolean;
  resultsPublic: boolean;
  hasVoted: boolean;
};
