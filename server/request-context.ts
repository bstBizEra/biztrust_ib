import { AsyncLocalStorage } from "node:async_hooks";

// Execution correlation only; identity and authorization still come from the actor.
export const requestIdContext = new AsyncLocalStorage<string>();
