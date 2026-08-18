// What counts as an operation of ours.
//
// A player record is a stint at a college. Most of them are stints we made
// happen, but not all: a player we took to the United States can transfer
// afterwards on his own, or through somebody else. That stint is real, it
// belongs in his career, and it should keep showing up in the roster and in
// "where are our players now" — but it is not an operation of Eture's, and
// counting it as one overstates what we did.
//
// So every figure that answers "how much has Eture done" filters on this, and
// every figure that answers "where are our players" does not. The two are
// different questions and the difference is the whole point of the flag.
export const ETURE_OPERATION = { active: true, byEture: true } as const;
