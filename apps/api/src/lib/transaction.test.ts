import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionContext } from "./transaction";
import { withTransaction } from "./transaction";

const { transactionMock } = vi.hoisted(() => ({
  transactionMock: vi.fn(),
}));

vi.mock("./prisma", () => ({
  prisma: { $transaction: transactionMock },
}));

const transactionContext = { user: {} } as unknown as TransactionContext;

describe("withTransaction", () => {
  beforeEach(() => {
    transactionMock.mockReset();
    transactionMock.mockImplementation(
      async (work: (tx: TransactionContext) => Promise<unknown>) =>
        work(transactionContext),
    );
  });

  it("returns the callback result from one Prisma transaction", async () => {
    const work = vi.fn().mockResolvedValue({ bookingId: "booking-01" });

    await expect(withTransaction(work)).resolves.toEqual({
      bookingId: "booking-01",
    });
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledOnce();
    expect(work).toHaveBeenCalledWith(transactionContext);
  });

  it("propagates callback errors to Prisma", async () => {
    const failure = new Error("atomic command failed");

    await expect(
      withTransaction(async () => {
        throw failure;
      }),
    ).rejects.toBe(failure);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});
