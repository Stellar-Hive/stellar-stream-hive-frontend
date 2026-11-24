import { afterAll, afterEach, beforeAll } from "vitest";
import "@testing-library/jest-dom/vitest";
import "vitest-axe/extend-expect";
import { setupServer } from "msw/node";
import { apiHandlers } from "@/lib/testing/handlers";

// Enable MSW for all tests
const server = setupServer(...apiHandlers);

beforeAll(() => {
  server.listen();
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
