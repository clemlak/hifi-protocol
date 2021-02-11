import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";

import { percentages, tokenAmounts } from "../../../../helpers/constants";

export default function shouldBehaveLikeGetCurrentCollateralizationRatio(): void {
  const debt: BigNumber = tokenAmounts.oneHundred.mul(BigNumber.from(2)); // TODO: Verify this amount
  const lockedCollaterals: BigNumber[] = [tokenAmounts.ten, tokenAmounts.ten];

  beforeEach(async function () {
    await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.stubs.fyToken.address);
    await this.contracts.balanceSheet.__godMode_setVaultLockedCollaterals(
      this.stubs.fyToken.address,
      this.accounts.borrower,
      lockedCollaterals,
    );
    await this.contracts.balanceSheet.__godMode_setVaultDebt(this.stubs.fyToken.address, this.accounts.borrower, debt);
  });

  it("returns the current collateralization ratio mantissa", async function () {
    const currentCollateralizationRatioMantissa: BigNumber = await this.contracts.balanceSheet.getCurrentCollateralizationRatio(
      this.stubs.fyToken.address,
      this.accounts.borrower,
    );
    expect(currentCollateralizationRatioMantissa).to.equal(percentages.oneThousand);
  });
}
