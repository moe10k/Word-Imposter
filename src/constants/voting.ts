export const SKIP_VOTE_ID = '__skip_vote__';

export function isSkipVoteId(votedId: string) {
  return votedId === SKIP_VOTE_ID;
}
