import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders the description when provided", () => {
    render(<EmptyState title="Nothing here" description="Create your first stream to get started." />);
    expect(screen.getByText("Create your first stream to get started.")).toBeInTheDocument();
  });

  it("does not render a description when omitted", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.queryByText("Create your first stream to get started.")).not.toBeInTheDocument();
  });

  it("renders the action when provided", () => {
    render(<EmptyState title="Nothing here" action={<button type="button">Create stream</button>} />);
    expect(screen.getByRole("button", { name: "Create stream" })).toBeInTheDocument();
  });

  it("does not render an action when omitted", () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
