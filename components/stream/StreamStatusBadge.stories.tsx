import type { Meta, StoryObj } from "@storybook/react";
import { StreamStatusBadge } from "./StreamStatusBadge";

const meta: Meta<typeof StreamStatusBadge> = {
  title: "stream/StreamStatusBadge",
  component: StreamStatusBadge,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof StreamStatusBadge>;

export const Scheduled: Story = { args: { status: "scheduled" } };
export const Active: Story = { args: { status: "active" } };
export const Cliff: Story = { args: { status: "cliff" } };
export const Cancelled: Story = { args: { status: "cancelled" } };
export const Completed: Story = { args: { status: "completed" } };
