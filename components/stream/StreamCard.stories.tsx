import type { Meta, StoryObj } from "@storybook/react";
import type { Stream } from "@/types";
import { StreamCard } from "./StreamCard";

const BASE_STREAM: Stream = {
  id: "1",
  sender: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7",
  recipient: "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H",
  token: { contractId: "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC", symbol: "XLM", decimals: 7 },
  totalAmount: "10000000000",
  withdrawnAmount: "2500000000",
  startLedger: 100,
  endLedger: 50000,
  startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endTime: Date.now() + 23 * 24 * 60 * 60 * 1000,
  cancellable: true,
  status: "active",
};

const meta: Meta<typeof StreamCard> = {
  title: "stream/StreamCard",
  component: StreamCard,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof StreamCard>;

export const ActiveSender: Story = {
  args: { stream: { ...BASE_STREAM, status: "active" }, role: "sender" },
};

export const ActiveRecipient: Story = {
  args: { stream: { ...BASE_STREAM, status: "active" }, role: "recipient" },
};

export const Scheduled: Story = {
  args: {
    stream: {
      ...BASE_STREAM,
      status: "scheduled",
      startTime: Date.now() + 2 * 24 * 60 * 60 * 1000,
    },
    role: "sender",
  },
};

export const CliffPending: Story = {
  args: {
    stream: {
      ...BASE_STREAM,
      status: "cliff",
      cliffLedger: 25000,
      cliffTime: Date.now() + 3 * 24 * 60 * 60 * 1000,
    },
    role: "recipient",
  },
};

export const Completed: Story = {
  args: {
    stream: {
      ...BASE_STREAM,
      status: "completed",
      withdrawnAmount: "10000000000",
      endTime: Date.now() - 24 * 60 * 60 * 1000,
    },
    role: "recipient",
  },
};

export const Cancelled: Story = {
  args: {
    stream: { ...BASE_STREAM, status: "cancelled", withdrawnAmount: "5000000000" },
    role: "sender",
  },
};
