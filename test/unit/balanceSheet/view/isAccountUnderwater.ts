import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";

import { fintrollerConstants, prices, tokenAmounts } from "../../../../helpers/constants";

export default function shouldBehaveLikeIsAccountUnderwater(): void {
  describe("when the vault is not open", function () {
    it("retrieves false", async function () {
      const isAccountUnderwater: boolean = await this.contracts.balanceSheet.isAccountUnderwater(
        this.stubs.fyToken.address,
        this.accounts.borrower,
      );
      expect(isAccountUnderwater).to.equal(false);
    });
  });

  describe("when the vault is open", function () {
    beforeEach(async function () {
      await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.stubs.fyToken.address);
    });

    describe("when the debt is zero", function () {
      it("retrieves false", async function () {
        const isAccountUnderwater: boolean = await this.contracts.balanceSheet.isAccountUnderwater(
          this.stubs.fyToken.address,
          this.accounts.borrower,
        );
        expect(isAccountUnderwater).to.equal(false);
      });
    });

    describe("when the debt is non-zero", function () {
      const debt: BigNumber = tokenAmounts.oneHundred;
      const lockedCollaterals: BigNumber[] = [tokenAmounts.ten, tokenAmounts.ten];

      beforeEach(async function () {
        await this.stubs.fintroller.mock.getBondCollateralizationRatio
          .withArgs(this.stubs.fyToken.address)
          .returns(fintrollerConstants.defaultCollateralizationRatio);
        await this.contracts.balanceSheet.__godMode_setVaultLockedCollaterals(
          this.stubs.fyToken.address,
          this.accounts.borrower,
          lockedCollaterals,
        );
        await this.contracts.balanceSheet.__godMode_setVaultDebt(
          this.stubs.fyToken.address,
          this.accounts.borrower,
          debt,
        );
      });

      describe("when the user is safely collateralized", function () {
        /* Recall that the default oracle price for 1 WETH is $100. */
        it("retrieves false", async function () {
          const isAccountUnderwater: boolean = await this.contracts.balanceSheet.isAccountUnderwater(
            this.stubs.fyToken.address,
            this.accounts.borrower,
          );
          expect(isAccountUnderwater).to.equal(false);
        });
      });

      describe("when the user is dangerously collateralized", function () {
        beforeEach(async function () {
          await this.stubs.oracle.mock.getAdjustedPrice.withArgs("WETH").returns(prices.twelveDollars.div(BigNumber.from(2))); // TODO: Verify this amount
        });

        /* The price of 1 WETH is $12 so the new collateralization ratio becomes 120%. */
        it("retrieves true", async function () {
          const isAccountUnderwater: boolean = await this.contracts.balanceSheet.isAccountUnderwater(
            this.stubs.fyToken.address,
            this.accounts.borrower,
          );
          expect(isAccountUnderwater).to.equal(true);
        });
      });
    });
  });
}
