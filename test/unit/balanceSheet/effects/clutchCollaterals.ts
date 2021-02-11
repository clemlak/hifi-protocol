import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";

import { BalanceSheetErrors } from "../../../../helpers/errors";
import { tokenAmounts } from "../../../../helpers/constants";

export default function shouldBehaveLikeClutchCollaterals(): void {
  const collateralAmounts: BigNumber[] = [tokenAmounts.fifty, tokenAmounts.fifty];

  describe("when the caller is not the fyToken contract", function () {
    it("reverts", async function () {
      await expect(
        this.contracts.balanceSheet
          .connect(this.signers.admin)
          .clutchCollaterals(
            this.stubs.fyToken.address,
            this.accounts.liquidator,
            this.accounts.borrower,
            collateralAmounts,
          ),
      ).to.be.revertedWith(BalanceSheetErrors.ClutchCollateralsNotAuthorized);
    });
  });
}
