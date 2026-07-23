import { EventEmitter } from 'events';

type AsyncFn = () => Promise<unknown>;
type RunnerKey = string | symbol;
type RunnerId = number;
declare enum RunnerType {
    KEY = "key",
    FN = "fn"
}
interface RunnerRuntimeMeta {
    stateId: RunnerId;
    sessionId: RunnerId;
    runId: RunnerId;
    runIndex: number;
}
interface RunnerKeyDescriptor {
    type: RunnerType.KEY;
    key: RunnerKey;
    name: string | undefined;
}
interface RunnerFnDescriptor {
    type: RunnerType.FN;
    name: string | undefined;
}
type RunnerDescriptor = RunnerKeyDescriptor | RunnerFnDescriptor;
type RunnerEventMeta = RunnerDescriptor & RunnerRuntimeMeta;
interface RunnerError {
    readonly cause: unknown;
    readonly meta: RunnerEventMeta;
}

declare class CoalescedRunner extends EventEmitter {
    private store;
    private stateIdCounter;
    private sessionIdCounter;
    private runIdCounter;
    private nextStateId;
    private nextSessionId;
    private nextRunId;
    run(fn: AsyncFn): void;
    runWithKey(key: RunnerKey, fn: AsyncFn): void;
    clearKey(key: RunnerKey): void;
    private assertKey;
    private createState;
    private handleError;
}

declare const globalRunner: CoalescedRunner;

declare class CoalescedRunnerError extends Error implements RunnerError {
    readonly cause: unknown;
    readonly meta: RunnerEventMeta;
    constructor(cause: unknown, meta: RunnerEventMeta);
}

export { type AsyncFn, CoalescedRunner, CoalescedRunnerError, type RunnerDescriptor, type RunnerError, type RunnerEventMeta, type RunnerFnDescriptor, type RunnerId, type RunnerKey, type RunnerKeyDescriptor, type RunnerRuntimeMeta, RunnerType, globalRunner };
