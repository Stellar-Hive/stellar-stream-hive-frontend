import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ErrorState } from "./ErrorState";

describe("ErrorState", () => {
  it("announces the error and keeps the retry action available", () => {
    const markup = renderToStaticMarkup(
      createElement(ErrorState, { message: "Could not load stream.", onRetry: () => {} })
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Something went wrong");
    expect(markup).toContain("Could not load stream.");
    expect(markup).toContain(">Try again</button>");
  });
});
