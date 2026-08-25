const MAX_FRIEND_COMPONENT_BOOST = 16;

export interface FriendActivitySignalOutput {
  friendComponentScore: number; // 0-100, 50 = no friends present
}

export function calculateFriendActivitySignal(friendsPresentCount: number): FriendActivitySignalOutput {
  if (friendsPresentCount <= 0) {
    return { friendComponentScore: 50 };
  }
  const boost = Math.min(MAX_FRIEND_COMPONENT_BOOST, friendsPresentCount * 5);
  return { friendComponentScore: 50 + boost };
}
