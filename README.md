# Coalesced Runner

> Lightweight async task coalescing with deterministic execution.
> Prevents race conditions by ensuring tasks run sequentially and coalesce repeated calls.

---

## Features

* **No race conditions** — never runs the same task concurrently
* **Coalescing** — multiple calls collapse into a single rerun
* **Event-driven** — lifecycle events (`start`, `success`, `error`, `drain`)
* **Fail-fast by default** — errors crash if unhandled
* **Key-based isolation** — separate execution per key
* **Memory-safe** — no function retention, automatic cleanup

---

## Installation

```bash
npm install coalesced-runner
```

---

## Quick Start

```ts
import { CoalescedRunner } from "coalesced-runner";

const runner = new CoalescedRunner();

const task = async () => {
  console.log("run");
};

runner.run(task);
runner.run(task);
runner.run(task);
```

### Output

```
run
run
```

Multiple calls are **coalesced** into:

* 1 execution immediately
* 1 rerun after completion (if triggered while running)

---

## How It Works

```
run() ──▶ [RUNNING]
            │
            ├─ run() → mark pending
            ├─ run() → still pending (no queue)
            │
            ▼
         [DONE]
            │
            └─ pending? → run once more
```

---

## Coalescing Behavior

```ts
runner.run(fn);
runner.run(fn);
runner.run(fn);
```

Executes:

```
fn() → fn()
```

At most **2 executions per burst**.

---

## Why this exists

In async systems, this pattern is common:

```ts
await updateState();
await updateState();
await updateState();
```

Without control, this causes:

* race conditions
* duplicated work
* inconsistent state

**CoalescedRunner guarantees:**

* only one task runs at a time
* repeated calls are merged into **at most one rerun**

---

## Key-based Execution

```ts
runner.runWithKey("user:1", async () => {
  // runs independently from other keys
});
```

Each key has its own isolated execution state.

---

## Events

The runner is event-driven using a familiar EventEmitter API.

### Available Events

| Event     | Description                 |
| --------- | --------------------------- |
| `start`   | Task execution started      |
| `success` | Task completed successfully |
| `error`   | Task failed                 |
| `drain`   | No more pending work (per state) |

---

### Example

```ts
import { RunnerEvents } from "coalesced-runner";

runner.on(RunnerEvents.ERROR, (err) => {
  console.error(err.meta, err.cause);
});

runner.on(RunnerEvents.DRAIN, (meta) => {
  console.log("idle");
});
```

---

## Meta (Typed Context)

Each event emits a **rich, typed meta object**.

---

### Descriptor (static)

Describes *what* is running:

```ts
type RunnerDescriptor =
  | { type: "fn"; name?: string }
  | { type: "key"; key: string | symbol; name?: string };
```

---

### Runtime (dynamic)

Describes *how it runs*:

```ts
type RunnerRuntimeMeta = {
  stateId: number;
  sessionId: number;
  runId: number;
  runIndex: number;
};
```

---

### Event Meta

```ts
type RunnerEventMeta = RunnerDescriptor & RunnerRuntimeMeta;
```

---

### Example

```ts
runner.on(RunnerEvents.START, (meta) => {
  console.log(meta.type);       // "fn" | "key"
  console.log(meta.stateId);    // stable per fn/key
  console.log(meta.sessionId);  // per execution burst
  console.log(meta.runId);      // unique per execution (global)
  console.log(meta.runIndex);   // position within session (0, 1, 2...)
});
```

---

## Execution Model

---

### State

Each function/key has a **state**:

* `stateId` → stable identity
* reused across runs

---

### Session

A **session** is a burst of executions:

* starts when idle → running
* ends at `drain`
* identified by `sessionId`

---

### Run

Each execution has:

* `runId` → globally unique
* `runIndex` → position **within the session**

---

### `runIndex` semantics

```ts
runIndex === 0  → first run in session
runIndex > 0    → rerun (coalesced)
```

---

### Example Timeline

```
stateId: 1

sessionId: 10
  runId: 1 (runIndex: 0)  ← first run
  runId: 2 (runIndex: 1)  ← rerun
  drain

sessionId: 11
  runId: 3 (runIndex: 0)  ← reset
  drain
```

---

## Detecting Reruns

```ts
runner.on(RunnerEvents.START, (meta) => {
  if (meta.runIndex === 0) {
    console.log("first run");
  } else {
    console.log("rerun");
  }
});
```

---

### Error Handling Behavior

* If an `error` listener exists → error is emitted
* If none → throws asynchronously (fail-fast)

```ts
runner.on(RunnerEvents.ERROR, (err) => {
  console.error(err.meta, err.cause);
});
```

---

## API

---

### `runner.run(fn)`

Run using **function identity** (`===`).

```ts
const fn = async () => {};

runner.run(fn);
runner.run(fn); // coalesced
```

---

### `runner.runWithKey(key, fn)`

Run using explicit key.

```ts
runner.runWithKey("user:1", async () => {
  await syncUser(1);
});
```

#### Key type

```ts
type RunnerKey = string | symbol;
```

---

### `runner.clearKey(key)`

Manually clear internal state.

```ts
runner.clearKey("user:1");
```

---

## Important Notes

### 1. This is NOT a queue

```ts
run()
run()
run()
```

Not: run 3 times
Actually: run **2 times**

---

### 2. Function identity matters

```ts
runner.run(async () => {});
runner.run(async () => {});
```

NOT coalesced (different functions)

---

### 3. Use keys for dynamic tasks

```ts
runner.runWithKey(`user:${id}`, fn);
```

---

### 4. Does NOT fix race inside your function

```ts
const fn = async () => {
  // your logic must still be safe
};
```

Runner only controls **execution timing**, not data correctness.

---

### 5. Fire-and-forget

```ts
runner.run(fn);
```

* does NOT return a Promise
* errors handled via event

---

## Example: Prevent Spam

```ts
const save = async () => {
  await api.save();
};

button.onclick = () => {
  runner.run(save);
};
```

spam click → no overload

---

## Example: Sync Latest State

```ts
runner.runWithKey("sync", async () => {
  await syncState();
});
```

ensures:

* no overlap
* always runs latest update

---

## When to Use

Use this when you need:

* prevent overlapping async tasks
* avoid queue buildup
* ensure latest update is applied
* handle burst events safely

---

## When NOT to Use

* need strict ordering → use queue
* need concurrency → use semaphore
* need dedupe only → use single-flight

---

## Comparison

| Pattern              | Behavior         |
| -------------------- | ---------------- |
| Queue                | runs all tasks   |
| Debounce             | delay + collapse |
| Throttle             | limit rate       |
| Single-flight        | run once only    |
| **Coalesced Runner** | run + 1 rerun    |

---

## License

MIT Yuki Akai

---
