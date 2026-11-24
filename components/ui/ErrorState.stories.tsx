import type { Meta, StoryObj } from "@storybook/react";
import { ErrorState } from "./ErrorState";

const meta: Meta<typeof ErrorState> = {
  title: "ui/ErrorState",
  component: ErrorState,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {
  args: { message: "Could not load stream data. The API may be temporarily unavailable." },
};

export const WithCustomTitle: Story = {
  args: {
    title: "Network error",
    message: "Failed to reach the Stellar RPC endpoint. Check your connection and try again.",
  },
};

export const WithRetry: Story = {
  args: {
    message: "Could not load stream data.",
    onRetry: () => { /* retry */ },
  },
};
