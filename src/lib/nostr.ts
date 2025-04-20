import { createRxNostr, noopVerifier } from "rx-nostr";

export const rxNostr = createRxNostr({
  skipVerify: true,
  verifier: noopVerifier,
});

export const DVM_RELAY = "wss://relay.vertexlab.io";

export const KINDS = {
  SEARCH_REQUEST: 5315,
  SEARCH_RESULT: 6315,
  JOB_FEEDBACK: 7000,
};
