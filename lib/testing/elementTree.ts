import type { ReactElement, ReactNode } from "react";

/**
 * Minimal helpers for asserting on the element tree returned by calling a
 * (hook-free) React function component directly, so component tests need no
 * DOM environment or extra dev dependencies.
 */
export type AnyElement = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyElement {
  return typeof node === "object" && node !== null && "props" in node;
}

/** Depth-first search for every element in `node` matching `predicate`. */
export function findAll(
  node: ReactNode,
  predicate: (element: AnyElement) => boolean,
  out: AnyElement[] = []
): AnyElement[] {
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child as ReactNode, predicate, out));
    return out;
  }
  if (isElement(node)) {
    if (predicate(node)) out.push(node);
    findAll(node.props.children as ReactNode, predicate, out);
  }
  return out;
}

/** Concatenated text content of every host/fragment child under `node`. */
export function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((child) => textOf(child as ReactNode)).join("");
  if (isElement(node)) return textOf(node.props.children as ReactNode);
  return "";
}
