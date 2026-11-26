// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { addDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { ONE_DAY_MS } from "@/lib/constants";
import { ScheduleInput, type ScheduleInputProps } from "./ScheduleInput";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// Provide a stable ledger snapshot so ledger labels are deterministic across
// CI environments and don't depend on a live RPC endpoint.
const LEDGER_NOW = 500_000;
const SNAPSHOT_TS = new Date("2026-11-24T12:00:00Z").getTime();

vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>();
  return {
    ...actual,
    fetchLatestLedgerSnapshot: vi.fn().mockResolvedValue({
      ledger: LEDGER_NOW,
      timestampMs: SNAPSHOT_TS,
    }),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = SNAPSHOT_TS; // align "now" with the snapshot for predictable labels

/** Builds default props for a 30-day stream starting 5 minutes from NOW. */
function defaultProps(overrides: Partial<ScheduleInputProps> = {}): ScheduleInputProps {
  const startDate = new Date(NOW + 5 * 60_000);
  const endDate = addDays(startDate, 30);
  return {
    startDate,
    onStartDateChange: vi.fn(),
    cliffDate: null,
    onCliffDateChange: vi.fn(),
    endDate,
    onEndDateChange: vi.fn(),
    ...overrides,
  };
}

function toLocalInputValue(date: Date): string {
  const tzOffsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

function renderSchedule(overrides: Partial<ScheduleInputProps> = {}) {
  const props = defaultProps(overrides);
  const { rerender } = render(<ScheduleInput {...props} />);
  return {
    props,
    rerender: (next: Partial<ScheduleInputProps>) => rerender(<ScheduleInput {...defaultProps(next)} />),
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe("ScheduleInput — rendering", () => {
  it("renders Start date and End date inputs", () => {
    renderSchedule();
    expect(screen.getByLabelText("Start date")).toBeInTheDocument();
    expect(screen.getByLabelText("End date")).toBeInTheDocument();
  });

  it("renders duration preset buttons", () => {
    renderSchedule();
    // The component exports DURATION_PRESETS_DAYS; we assert the labels appear
    expect(screen.getByRole("button", { name: "7d" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30d" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "90d" })).toBeInTheDocument();
  });

  it("does not show the cliff date input by default", () => {
    renderSchedule();
    expect(screen.queryByLabelText("Cliff date")).toBeNull();
  });

  it("shows no order-error message when end is after start", () => {
    renderSchedule();
    expect(screen.queryByText(/End date must be after the start date/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Order validation
// ---------------------------------------------------------------------------

describe("ScheduleInput — order validation", () => {
  it("shows an error when end date equals start date", () => {
    const startDate = new Date(NOW + 5 * 60_000);
    renderSchedule({ startDate, endDate: startDate });
    expect(screen.getByText("End date must be after the start date.")).toBeInTheDocument();
  });

  it("shows an error when end date is before start date", () => {
    const startDate = new Date(NOW + 10 * 60_000);
    const endDate = new Date(NOW + 5 * 60_000);
    renderSchedule({ startDate, endDate });
    expect(screen.getByText("End date must be after the start date.")).toBeInTheDocument();
  });

  it("shows an error when cliff date is before start date", () => {
    const startDate = new Date(NOW + 10 * 60_000);
    const endDate = addDays(startDate, 30);
    const cliffDate = new Date(startDate.getTime() - 60_000); // 1 minute before start
    renderSchedule({ startDate, endDate, cliffDate });
    expect(screen.getByText("Cliff date must be between the start and end dates.")).toBeInTheDocument();
  });

  it("shows an error when cliff date is after end date", () => {
    const startDate = new Date(NOW + 10 * 60_000);
    const endDate = addDays(startDate, 30);
    const cliffDate = new Date(endDate.getTime() + 60_000); // 1 minute after end
    renderSchedule({ startDate, endDate, cliffDate });
    expect(screen.getByText("Cliff date must be between the start and end dates.")).toBeInTheDocument();
  });

  it("does not show an order error when cliff date is exactly equal to start date", () => {
    const startDate = new Date(NOW + 10 * 60_000);
    const endDate = addDays(startDate, 30);
    renderSchedule({ startDate, endDate, cliffDate: startDate });
    expect(screen.queryByText(/Cliff date must be/)).toBeNull();
    expect(screen.queryByText(/End date must be/)).toBeNull();
  });

  it("does not show an order error when cliff date is exactly equal to end date", () => {
    const startDate = new Date(NOW + 10 * 60_000);
    const endDate = addDays(startDate, 30);
    renderSchedule({ startDate, endDate, cliffDate: endDate });
    expect(screen.queryByText(/Cliff date must be/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Past-start warning
// ---------------------------------------------------------------------------

describe("ScheduleInput — past-start warning", () => {
  it("shows a warning when start date is more than 60 s in the past", () => {
    // Start more than 60 s before the snapshot timestamp so the warning fires.
    const startDate = new Date(SNAPSHOT_TS - 2 * 60_000);
    const endDate = addDays(startDate, 30);

    // We mock Date.now to return SNAPSHOT_TS so the component's check is deterministic.
    const spy = vi.spyOn(Date, "now").mockReturnValue(SNAPSHOT_TS);
    renderSchedule({ startDate, endDate });
    expect(
      screen.getByText(/Start date is in the past — the recipient will immediately see some balance/)
    ).toBeInTheDocument();
    spy.mockRestore();
  });

  it("does not show the past-start warning when start is in the future", () => {
    const spy = vi.spyOn(Date, "now").mockReturnValue(SNAPSHOT_TS);
    renderSchedule(); // default start is 5 min in the future
    expect(screen.queryByText(/Start date is in the past/)).toBeNull();
    spy.mockRestore();
  });

  it("does not show the past-start warning when there is an order error", () => {
    // End before start → order error takes precedence; warning should be suppressed
    const startDate = new Date(SNAPSHOT_TS - 2 * 60_000);
    const endDate = new Date(startDate.getTime() - 60_000);
    const spy = vi.spyOn(Date, "now").mockReturnValue(SNAPSHOT_TS);
    renderSchedule({ startDate, endDate });
    expect(screen.queryByText(/Start date is in the past/)).toBeNull();
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// Preset buttons
// ---------------------------------------------------------------------------

describe("ScheduleInput — duration preset buttons", () => {
  it("calls onEndDateChange with startDate + N days when a preset is clicked", () => {
    const startDate = new Date(NOW + 5 * 60_000);
    const onEndDateChange = vi.fn();
    render(<ScheduleInput {...defaultProps({ startDate, onEndDateChange })} />);

    fireEvent.click(screen.getByRole("button", { name: "7d" }));
    expect(onEndDateChange).toHaveBeenCalledWith(addDays(startDate, 7));
  });

  it("calls onEndDateChange with startDate + 30 days for the 30d preset", () => {
    const startDate = new Date(NOW + 5 * 60_000);
    const onEndDateChange = vi.fn();
    render(<ScheduleInput {...defaultProps({ startDate, onEndDateChange })} />);

    fireEvent.click(screen.getByRole("button", { name: "30d" }));
    expect(onEndDateChange).toHaveBeenCalledWith(addDays(startDate, 30));
  });

  it("marks the active preset with aria-pressed=true", () => {
    const startDate = new Date(NOW + 5 * 60_000);
    const endDate = addDays(startDate, 30);
    renderSchedule({ startDate, endDate });

    const btn30 = screen.getByRole("button", { name: "30d" });
    expect(btn30).toHaveAttribute("aria-pressed", "true");

    const btn7 = screen.getByRole("button", { name: "7d" });
    expect(btn7).toHaveAttribute("aria-pressed", "false");
  });
});

// ---------------------------------------------------------------------------
// Date field callbacks
// ---------------------------------------------------------------------------

describe("ScheduleInput — date field callbacks", () => {
  it("calls onStartDateChange when the start date input changes", () => {
    const onStartDateChange = vi.fn();
    render(<ScheduleInput {...defaultProps({ onStartDateChange })} />);

    const newStart = new Date(NOW + 60 * 60_000);
    fireEvent.change(screen.getByLabelText("Start date"), {
      target: { value: toLocalInputValue(newStart) },
    });

    expect(onStartDateChange).toHaveBeenCalledOnce();
    // The called value should be a Date parsed from the input value
    expect(onStartDateChange.mock.calls[0][0]).toBeInstanceOf(Date);
  });

  it("calls onEndDateChange when the end date input changes", () => {
    const onEndDateChange = vi.fn();
    const startDate = new Date(NOW + 5 * 60_000);
    render(<ScheduleInput {...defaultProps({ startDate, onEndDateChange })} />);

    const newEnd = addDays(startDate, 60);
    fireEvent.change(screen.getByLabelText("End date"), {
      target: { value: toLocalInputValue(newEnd) },
    });

    expect(onEndDateChange).toHaveBeenCalledOnce();
    expect(onEndDateChange.mock.calls[0][0]).toBeInstanceOf(Date);
  });

  it("does not call onChange when the datetime-local value is empty", () => {
    const onStartDateChange = vi.fn();
    render(<ScheduleInput {...defaultProps({ onStartDateChange })} />);

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "" } });
    expect(onStartDateChange).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Cliff date toggle
// ---------------------------------------------------------------------------

describe("ScheduleInput — cliff date toggle", () => {
  it("shows the cliff date input after enabling the checkbox", () => {
    renderSchedule();
    expect(screen.queryByLabelText("Cliff date")).toBeNull();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByLabelText("Cliff date")).toBeInTheDocument();
  });

  it("calls onCliffDateChange with a Date 1 day after startDate when checkbox is checked", () => {
    const startDate = new Date(NOW + 5 * 60_000);
    const onCliffDateChange = vi.fn();
    render(<ScheduleInput {...defaultProps({ startDate, onCliffDateChange })} />);

    fireEvent.click(screen.getByRole("checkbox"));
    expect(onCliffDateChange).toHaveBeenCalledOnce();
    const cliff: Date = onCliffDateChange.mock.calls[0][0];
    expect(cliff).toBeInstanceOf(Date);
    expect(cliff.getTime()).toBe(startDate.getTime() + ONE_DAY_MS);
  });

  it("calls onCliffDateChange with null when the checkbox is unchecked", () => {
    const startDate = new Date(NOW + 5 * 60_000);
    const cliffDate = addDays(startDate, 1);
    const onCliffDateChange = vi.fn();
    render(<ScheduleInput {...defaultProps({ startDate, cliffDate, onCliffDateChange })} />);

    // Checkbox starts checked because cliffDate is non-null
    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(onCliffDateChange).toHaveBeenCalledWith(null);
  });

  it("calls onCliffDateChange when the cliff date input changes", () => {
    const startDate = new Date(NOW + 5 * 60_000);
    const cliffDate = addDays(startDate, 1);
    const onCliffDateChange = vi.fn();
    render(<ScheduleInput {...defaultProps({ startDate, cliffDate, onCliffDateChange })} />);

    const newCliff = addDays(startDate, 5);
    fireEvent.change(screen.getByLabelText("Cliff date"), {
      target: { value: toLocalInputValue(newCliff) },
    });

    expect(onCliffDateChange).toHaveBeenCalledOnce();
    expect(onCliffDateChange.mock.calls[0][0]).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Ledger labels
// ---------------------------------------------------------------------------

describe("ScheduleInput — ledger labels", () => {
  it("shows ledger labels once the snapshot has loaded", async () => {
    renderSchedule();
    // Labels show "≈ ledger N" once fetchLatestLedgerSnapshot resolves
    await screen.findByText(/≈ ledger/);
    // Should appear for both start and end dates
    const labels = screen.getAllByText(/≈ ledger/);
    expect(labels.length).toBeGreaterThanOrEqual(2);
  });

  it("shows no ledger labels before the snapshot resolves", () => {
    // fetchLatestLedgerSnapshot is mocked to resolve immediately in beforeEach,
    // so we override it here to remain pending.
    const { fetchLatestLedgerSnapshot } = vi.mocked(
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("@/lib/stellar")
    );
    fetchLatestLedgerSnapshot.mockReturnValue(new Promise(() => undefined)); // never resolves

    renderSchedule();
    expect(screen.queryByText(/≈ ledger/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Timezone offset
// ---------------------------------------------------------------------------

describe("ScheduleInput — timezone offset", () => {
  it("shows the timezone offset label after mount", async () => {
    renderSchedule();
    // The label is hidden until isMounted becomes true (avoids SSR hydration mismatch).
    // After a render cycle it should appear.
    await screen.findByText(/Times are in your local timezone/);
    expect(screen.getByText(/UTC/)).toBeInTheDocument();
  });
});
