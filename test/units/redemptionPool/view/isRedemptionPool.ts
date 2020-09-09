import { expect } from "chai";

export default function shouldBehaveLikeIsRedemptionPoolGetter(): void {
  it("retrieves the state of the 'isRedemptionPool' storage property", async function () {
    const isRedemptionPool: boolean = await this.contracts.redemptionPool.isRedemptionPool();
    expect(isRedemptionPool).to.equal(true);
  });
}
