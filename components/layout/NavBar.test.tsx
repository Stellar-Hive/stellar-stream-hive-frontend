import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { findAll, textOf, type AnyElement } from "@/lib/testing/elementTree";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: vi.fn() };
});
vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next/link", () => ({ default: ({ children }: { children: unknown }) => children }));
vi.mock("@/components/wallet/ConnectButton", () => ({ ConnectButton: () => null }));
vi.mock("@/components/wallet/NetworkBadge", () => ({ NetworkBadge: () => null }));

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { NavBar } from "./NavBar";

const setMobileOpen = vi.fn();

function render(pathname: string, mobileOpen = false) {
  (usePathname as Mock).mockReturnValue(pathname);
  (useState as Mock).mockReturnValue([mobileOpen, setMobileOpen]);
  return NavBar();
}

const isHighlighted = (link: AnyElement) => String(link.props.className).includes("bg-surface");
const navs = (element: ReturnType<typeof NavBar>) => findAll(element, (el) => el.type === "nav");
const linksIn = (nav: AnyElement) => findAll(nav, (el) => el.type === Link);

describe("NavBar", () => {
  beforeEach(() => vi.clearAllMocks());

  it("highlights only the link for the current page", () => {
    const [desktop] = navs(render("/sending"));
    const links = linksIn(desktop);

    expect(links.map((link) => link.props.href)).toEqual(["/streams/new", "/sending", "/receiving"]);
    expect(links.filter(isHighlighted).map((link) => link.props.href)).toEqual(["/sending"]);
  });

  it("highlights nothing on a page that is not in the menu", () => {
    const [desktop] = navs(render("/"));
    expect(linksIn(desktop).filter(isHighlighted)).toHaveLength(0);
  });

  it("keeps the mobile menu closed by default", () => {
    const element = render("/sending", false);
    const [toggle] = findAll(element, (el) => el.props["aria-label"] === "Toggle navigation menu");

    expect(toggle.props["aria-expanded"]).toBe(false);
    expect(navs(element)).toHaveLength(1);
  });

  it("toggles the mobile menu open and closed", () => {
    const [toggle] = findAll(render("/sending", false), (el) => el.props["aria-label"] === "Toggle navigation menu");
    (toggle.props.onClick as () => void)();

    const call = setMobileOpen.mock.calls[0];
    if (!call) throw new Error("Expected setMobileOpen to have been called");
    const updater = (call[0] ?? undefined) as ((open: boolean) => boolean) | undefined;
    if (!updater) throw new Error("Expected call[0] to be a function");
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  it("renders the mobile links, highlighting the current page, when open", () => {
    const element = render("/receiving", true);
    const [, mobile] = navs(element);
    const [toggle] = findAll(element, (el) => el.props["aria-label"] === "Toggle navigation menu");

    expect(toggle.props["aria-expanded"]).toBe(true);
    expect(
      linksIn(mobile)
        .filter(isHighlighted)
        .map((link) => textOf(link))
    ).toEqual(["Receiving"]);
  });

  it("closes the mobile menu when a link is chosen", () => {
    const [, mobile] = navs(render("/sending", true));
    const firstLink = linksIn(mobile)[0];
    if (!firstLink) throw new Error("Expected at least one link in mobile nav");
    (firstLink.props.onClick as () => void)();

    expect(setMobileOpen).toHaveBeenCalledWith(false);
  });
});
