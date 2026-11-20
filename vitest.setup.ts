import "@testing-library/jest-dom/vitest";
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
