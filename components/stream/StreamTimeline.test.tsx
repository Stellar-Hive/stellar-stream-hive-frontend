import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StreamTimeline } from "./StreamTimeline";

const startTime = new Date(2026, 10, 20, 10, 0).getTime();
const cliffTime = new Date(2026, 10, 20, 10, 15).getTime();
const endTime = new Date(2026, 10, 20, 11, 0).getTime();
const schedule = { startLedger: 100, endLedger: 200, startTime, endTime };

describe("StreamTimeline", () => {
  it("renders the start and end dates without a cliff", () => {
    render(<StreamTimeline {...schedule} enabled={false} simulatedReference={{ ledger: 150, timestampMs: startTime }} />);

    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Nov 20, 10:00")).toBeInTheDocument();
    expect(screen.getByText("End")).toBeInTheDocument();
    expect(screen.getByText("Nov 20, 11:00")).toBeInTheDocument();
    expect(screen.queryByTitle("Cliff")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Stream is 50% through" })).toBeInTheDocument();
  });

  it.each([
    [90, 0],
    [120, 20],
    [125, 25],
    [160, 60],
    [210, 100],
  ])("positions now at %i ledgers as %i%% of the timeline", (ledger, percent) => {
    render(
      <StreamTimeline
        {...schedule}
        cliffLedger={125}
        cliffTime={cliffTime}
        enabled={false}
        simulatedReference={{ ledger, timestampMs: startTime }}
      />,
    );

    expect(screen.getByText("Cliff")).toBeInTheDocument();
    expect(screen.getByText("Nov 20, 10:15")).toBeInTheDocument();
    expect(screen.getByTitle("Cliff")).toHaveStyle({ left: "25%" });
    expect(screen.getByTitle("Now")).toHaveStyle({ left: `${percent}%` });
    expect(screen.getByRole("img", { name: `Stream is ${percent}% through; cliff at 25%` })).toBeInTheDocument();
  });
});
