import { describe, expect, it, vi } from "vitest";
import { findAll, textOf } from "@/lib/testing/elementTree";
import { RecipientInput } from "./RecipientInput";

const VALID = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

function render(value: string, senderAddress: string | null = null, onChange = vi.fn()) {
  return RecipientInput({ value, onChange, senderAddress });
}

describe("RecipientInput", () => {
  it("shows no validation message while the field is empty", () => {
    const text = textOf(render(""));
    expect(text).not.toContain("Enter a valid Stellar account address");
    expect(text).not.toContain("Valid Stellar address.");
  });

  it("explains what a valid address looks like when the input is malformed", () => {
    const text = textOf(render("GABC"));
    expect(text).toContain("Enter a valid Stellar account address");
    expect(text).not.toContain("Valid Stellar address.");
  });

  it("rejects a contract (C...) address", () => {
    const text = textOf(render("CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"));
    expect(text).toContain("Enter a valid Stellar account address");
  });

  it("confirms a valid address", () => {
    const text = textOf(render(VALID));
    expect(text).toContain("Valid Stellar address.");
    expect(text).not.toContain("Enter a valid Stellar account address");
  });

  it("rejects the connected wallet as the recipient", () => {
    const text = textOf(render(VALID, VALID));
    expect(text).toContain("The recipient can't be your own address.");
    expect(text).not.toContain("Valid Stellar address.");
  });

  it("accepts a valid recipient that differs from the connected wallet", () => {
    const other = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
    expect(textOf(render(VALID, other))).toContain("Valid Stellar address.");
  });

  it("trims whitespace before reporting changes", () => {
    const onChange = vi.fn();
    const [input] = findAll(render("", null, onChange), (el) => el.type === "input");

    (input.props.onChange as (e: { target: { value: string } }) => void)({
      target: { value: `  ${VALID}\n` },
    });

    expect(onChange).toHaveBeenCalledWith(VALID);
  });

  it("marks an invalid field with the danger border", () => {
    const [input] = findAll(render("GABC"), (el) => el.type === "input");
    expect(String(input.props.className)).toContain("border-danger");
  });
});
