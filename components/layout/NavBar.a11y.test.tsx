import { render } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import { axe } from "vitest-axe";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/wallet/ConnectButton", () => ({ ConnectButton: () => null }));
vi.mock("@/components/wallet/NetworkBadge", () => ({ NetworkBadge: () => null }));

import { usePathname } from "next/navigation";
import { NavBar } from "./NavBar";

describe("NavBar accessibility", () => {
  it("has no axe violations", async () => {
    (usePathname as Mock).mockReturnValue("/sending");
    const { container } = render(<NavBar />);

    expect(await axe(container)).toHaveNoViolations();
  });
});
