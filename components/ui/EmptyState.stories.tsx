import type { Meta, StoryObj } from "@storybook/react";
import { EmptyState } from "./EmptyState";

const meta: Meta<typeof EmptyState> = {
  title: "ui/EmptyState",
  component: EmptyState,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const Default: Story = {
  args: { title: "Nothing here yet" },
};

export const WithDescription: Story = {
  args: {
    title: "No streams yet",
    description: "Streams you create will appear here once the indexer picks them up.",
  },
};

export const WithAction: Story = {
  args: {
    title: "No outgoing streams",
    description: "Create your first payment stream to get started.",
    action: <a href="#" className="btn-primary">Create a stream</a>,
  },
};
