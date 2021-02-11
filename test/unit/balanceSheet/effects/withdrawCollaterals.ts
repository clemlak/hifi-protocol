import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { BalanceSheetErrors, GenericErrors } from "../../../../helpers/errors";
import { tokenAmounts } from "../../../../helpers/constants";

export default function shouldBehaveLikeWithdrawCollateral(): void {
  const collateralAmounts: BigNumber[] = [tokenAmounts.ten, tokenAmounts.ten];

  describe("when the vault is not open", function () {
    it("reverts", async function () {
      await expect(
        this.contracts.balanceSheet
          .connect(this.signers.borrower)
          .withdrawCollaterals(this.stubs.fyToken.address, collateralAmounts),
      ).to.be.revertedWith(GenericErrors.VaultNotOpen);
    });
  });

  describe("when the vault is open", function () {
    beforeEach(async function () {
      await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.stubs.fyToken.address);
    });

    describe("when the amounts to withdraw are zero", function () {
      it("reverts", async function () {
        await expect(
          this.contracts.balanceSheet
            .connect(this.signers.borrower)
            .withdrawCollaterals(this.stubs.fyToken.address, [Zero, Zero]),
        ).to.be.revertedWith(BalanceSheetErrors.WithdrawCollateralsZero);
      });
    });

    describe("when the amounts to withdraw are not zero", function () {
      describe("when the caller did not deposit any collateral", function () {
        it("reverts", async function () {
          await expect(
            this.contracts.balanceSheet
              .connect(this.signers.borrower)
              .withdrawCollaterals(this.stubs.fyToken.address, collateralAmounts),
          ).to.be.revertedWith(BalanceSheetErrors.InsufficientFreeCollaterals);
        });
      });

      describe("when the caller deposited collateral", function () {
        beforeEach(async function () {
          await this.stubs.fintroller.mock.getDepositCollateralAllowed
            .withArgs(this.stubs.fyToken.address)
            .returns(true);

          for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
            await this.stubs.collaterals[i].mock.transferFrom
              .withArgs(this.accounts.borrower, this.contracts.balanceSheet.address, collateralAmounts[i])
              .returns(true);
          }

          await this.contracts.balanceSheet
            .connect(this.signers.borrower)
            .depositCollaterals(this.stubs.fyToken.address, collateralAmounts);
        });

        describe("when the caller locked the collaterals", function () {
          beforeEach(async function () {
            await this.contracts.balanceSheet
              .connect(this.signers.borrower)
              .lockCollaterals(this.stubs.fyToken.address, collateralAmounts);
          });

          it("reverts", async function () {
            await expect(
              this.contracts.balanceSheet
                .connect(this.signers.borrower)
                .withdrawCollaterals(this.stubs.fyToken.address, collateralAmounts),
            ).to.be.revertedWith(BalanceSheetErrors.InsufficientFreeCollaterals);
          });
        });

        describe("when the caller did not lock the collaterals", function () {
          beforeEach(async function () {
            for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
              await this.stubs.collaterals[i].mock.transfer.withArgs(this.accounts.borrower, collateralAmounts[i]).returns(true);
            }
          });

          it("makes the collateral withdrawals", async function () {
            await this.contracts.balanceSheet
              .connect(this.signers.borrower)
              .withdrawCollaterals(this.stubs.fyToken.address, collateralAmounts);
          });

          it("emits a WithdrawCollaterals event", async function () {
            await expect(
              this.contracts.balanceSheet
                .connect(this.signers.borrower)
                .withdrawCollaterals(this.stubs.fyToken.address, collateralAmounts),
            )
              .to.emit(this.contracts.balanceSheet, "WithdrawCollaterals")
              .withArgs(this.stubs.fyToken.address, this.accounts.borrower, this.stubs.collaterals.map((collateral) => (collateral.address)), collateralAmounts);
          });
        });
      });
    });
  });
}
