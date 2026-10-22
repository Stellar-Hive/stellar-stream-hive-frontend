import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AVERAGE_LEDGER_SECONDS } from "@/lib/streaming";
import { TICK_MS } from "@/lib/constants";

/**
 * A tiny synchronous hook runtime (useState / useEffect / useRef) so the hook
 * can be exercised with fake timers without a DOM or react-test-renderer.
 */
const runtime = vi.hoisted(() => {
  type Slot = { value?: unknown; deps?: unknown[]; cleanup?: unknown };
  const state = {
    slots: [] as Slot[],
    index: 0,
    pending: [] as Array<() => void>,
    render: (() => undefined) as () => void,
    rendering: false,
    dirty: false,
  };
  return state;
});

vi.mock("react", () => {
  const depsChanged = (next: unknown[] | undefined, prev: unknown[] | undefined) =>
    !next || !prev || next.some((dep, i) => !Object.is(dep, prev[i]));

  return {
    useState: <T,>(initial: T | (() => T)) => {
      const i = runtime.index++;
      if (!(i in runtime.slots)) {
        runtime.slots[i] = { value: typeof initial === "function" ? (initial as () => T)() : initial };
      }
      const setState = (next: T | ((prev: T) => T)) => {
        const slot = runtime.slots[i];
        const value = typeof next === "function" ? (next as (prev: T) => T)(slot.value as T) : next;
        if (Object.is(value, slot.value)) return;
        slot.value = value;
        if (runtime.rendering) runtime.dirty = true;
        else runtime.render();
      };
      return [runtime.slots[i].value as T, setState] as const;
    },
    useRef: <T,>(initial: T) => {
      const i = runtime.index++;
      if (!(i in runtime.slots)) runtime.slots[i] = { value: { current: initial } };
      return runtime.slots[i].value as { current: T };
    },
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => {
      const i = runtime.index++;
      const previous = runtime.slots[i];
      if (previous && !depsChanged(deps, previous.deps)) return;
      runtime.slots[i] = { deps, cleanup: previous?.cleanup };
      runtime.pending.push(() => {
        (runtime.slots[i].cleanup as (() => void) | undefined)?.();
        runtime.slots[i].cleanup = effect();
      });
    },
  };
});

const fetchLatestLedgerSnapshot = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stellar", () => ({ fetchLatestLedgerSnapshot }));

import { useLiveBalance, type UseLiveBalanceParams } from "./useLiveBalance";

const T0 = Date.UTC(2026, 0, 1);
const LEDGER_MS = AVERAGE_LEDGER_SECONDS * 1_000;

function renderHook(params: UseLiveBalanceParams) {
  const result = { current: undefined as unknown as ReturnType<typeof useLiveBalance> };
  runtime.slots = [];
  runtime.pending = [];
  runtime.render = () => {
    runtime.rendering = true;
    do {
      runtime.dirty = false;
      runtime.index = 0;
      result.current = useLiveBalance(params);
      const effects = runtime.pending;
      runtime.pending = [];
      effects.forEach((run) => run());
    } while (runtime.dirty);
    runtime.rendering = false;
  };
  runtime.render();
  return {
    result,
    unmount: () =>
      runtime.slots.forEach((slot) => (slot.cleanup as (() => void) | undefined)?.()),
  };
}

const PARAMS = {
  totalAmount: 1_000n,
  withdrawnAmount: 0n,
  startLedger: 100,
  endLedger: 200,
  simulatedReference: { ledger: 100, timestampMs: T0 },
} satisfies UseLiveBalanceParams;

describe("useLiveBalance (simulated mode)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
    fetchLatestLedgerSnapshot.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts ready with nothing withdrawable and never touches the network", () => {
    const { result, unmount } = renderHook(PARAMS);

    expect(result.current).toMatchObject({
      isLoading: false,
      error: null,
      withdrawable: 0n,
      streamed: 0n,
      progress: 0,
    });
    expect(result.current.lastSyncedAt).not.toBeNull();
    vi.advanceTimersByTime(60_000);
    expect(fetchLatestLedgerSnapshot).not.toHaveBeenCalled();
    unmount();
  });

  it("ticks the withdrawable amount up as estimated ledgers elapse", () => {
    const { result, unmount } = renderHook(PARAMS);

    vi.advanceTimersByTime(LEDGER_MS * 10);
    // 10 ledgers into a 100-ledger stream of 1000 base units.
    expect(result.current.streamed).toBe(100n);
    expect(result.current.withdrawable).toBe(100n);
    expect(result.current.progress).toBeCloseTo(0.1);

    vi.advanceTimersByTime(LEDGER_MS * 10);
    expect(result.current.withdrawable).toBe(200n);
    unmount();
  });

  it("re-renders every tick but only advances once a whole ledger has elapsed", () => {
    const { result, unmount } = renderHook(PARAMS);

    vi.advanceTimersByTime(LEDGER_MS - TICK_MS);
    expect(result.current.withdrawable).toBe(0n);

    vi.advanceTimersByTime(TICK_MS);
    expect(result.current.withdrawable).toBe(10n);
    unmount();
  });

  it("subtracts what was already withdrawn", () => {
    const { result, unmount } = renderHook({ ...PARAMS, withdrawnAmount: 60n });

    vi.advanceTimersByTime(LEDGER_MS * 10);
    expect(result.current.streamed).toBe(100n);
    expect(result.current.withdrawable).toBe(40n);
    unmount();
  });

  it("holds at zero until the cliff ledger is reached", () => {
    const { result, unmount } = renderHook({ ...PARAMS, cliffLedger: 150 });

    vi.advanceTimersByTime(LEDGER_MS * 49);
    expect(result.current.withdrawable).toBe(0n);

    vi.advanceTimersByTime(LEDGER_MS);
    expect(result.current.withdrawable).toBe(500n);
    unmount();
  });

  it("caps the amount at the total once the stream has ended", () => {
    const { result, unmount } = renderHook(PARAMS);

    vi.advanceTimersByTime(LEDGER_MS * 500);
    expect(result.current.withdrawable).toBe(1_000n);
    expect(result.current.progress).toBe(1);
    unmount();
  });

  it("freezes the balance when disabled", () => {
    const { result, unmount } = renderHook({ ...PARAMS, enabled: false });

    vi.advanceTimersByTime(LEDGER_MS * 50);
    expect(result.current.withdrawable).toBe(0n);
    unmount();
  });

  it("fetches the ledger snapshot exactly once when disabled and reports the remaining balance", async () => {
    fetchLatestLedgerSnapshot.mockResolvedValue({ ledger: 200, timestampMs: T0 });

    const { result, unmount } = renderHook({
      ...PARAMS,
      enabled: false,
      withdrawnAmount: 400n,
    });

    // Before the initial fetch resolves the hook must report a loading state.
    expect(result.current.isLoading).toBe(true);
    expect(fetchLatestLedgerSnapshot).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => expect(result.current.isLoading).toBe(false));

    // Completed stream: everything streamed, minus what was already withdrawn.
    expect(result.current.streamed).toBe(1_000n);
    expect(result.current.withdrawable).toBe(600n);
    expect(result.current.progress).toBe(1);

    // No interval: further time must not trigger more fetches or change values.
    vi.advanceTimersByTime(LEDGER_MS * 50);
    expect(fetchLatestLedgerSnapshot).toHaveBeenCalledTimes(1);
    expect(result.current.withdrawable).toBe(600n);
    unmount();
  });

  it("stops ticking after unmount", () => {
    const { result, unmount } = renderHook(PARAMS);
    unmount();

    vi.advanceTimersByTime(LEDGER_MS * 10);
    expect(result.current.withdrawable).toBe(0n);
  });
});
