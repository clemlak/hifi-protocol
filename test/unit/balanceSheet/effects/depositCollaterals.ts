import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { BalanceSheetErrors, FintrollerErrors, GenericErrors } from "../../../../helpers/errors";
import { fintrollerConstants, tokenAmounts } from "../../../../helpers/constants";

export default function shouldBehaveLikeDepositCollaterals(): void {
  const collateralAmounts: BigNumber[] = [tokenAmounts.ten, tokenAmounts.ten];
  const zeroCollateralAmounts: BigNumber[] = [Zero, Zero];

  describe("when the vault is not open", function () {
    it("reverts", async function () {
      await expect(
        this.contracts.balanceSheet
          .connect(this.signers.borrower)
          .depositCollaterals(this.stubs.fyToken.address, collateralAmounts),
      ).to.be.revertedWith(GenericErrors.VaultNotOpen);
    });
  });

  describe("when the vault is open", function () {
    beforeEach(async function () {
      await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.stubs.fyToken.address);
    });

    describe("when the amounts to deposit are zero", function () {
      it("reverts", async function () {
        await expect(
          this.contracts.balanceSheet
            .connect(this.signers.borrower)
            .depositCollaterals(this.stubs.fyToken.address, zeroCollateralAmounts),
        ).to.be.revertedWith(BalanceSheetErrors.DepositCollateralsZero);
      });
    });

    describe("when the amounts to deposit are not zero", function () {
      describe("when the bond is not listed", function () {
        beforeEach(async function () {
          await this.stubs.fintroller.mock.getDepositCollateralAllowed
            .withArgs(this.stubs.fyToken.address)
            .revertsWithReason(FintrollerErrors.BondNotListed);
        });

        it("reverts", async function () {
          await expect(
            this.contracts.balanceSheet
              .connect(this.signers.borrower)
              .depositCollaterals(this.stubs.fyToken.address, collateralAmounts),
          ).to.be.revertedWith(FintrollerErrors.BondNotListed);
        });
      });

      describe("when the bond is listed", function () {
        beforeEach(async function () {
          await this.stubs.fintroller.mock.getBondCollateralizationRatio
            .withArgs(this.stubs.fyToken.address)
            .returns(fintrollerConstants.defaultCollateralizationRatio);
        });

        describe("when the fintroller does not allow deposit collaterals", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getDepositCollateralAllowed
              .withArgs(this.stubs.fyToken.address)
              .returns(false);
          });

          it("reverts", async function () {
            await expect(
              this.contracts.balanceSheet
                .connect(this.signers.borrower)
                .depositCollaterals(this.stubs.fyToken.address, collateralAmounts),
            ).to.be.revertedWith(BalanceSheetErrors.DepositCollateralsNotAllowed);
          });
        });

        describe("when the fintroller allows deposit collateral", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getDepositCollateralAllowed
              .withArgs(this.stubs.fyToken.address)
              .returns(true);
          });

          describe("when the call to transfer the collaterals does not succeed", function () {
            beforeEach(async function () {
              for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
                await this.stubs.collaterals[i].mock.transferFrom
                  .withArgs(this.accounts.borrower, this.contracts.balanceSheet.address, collateralAmounts[i])
                  .returns(false);
              }
            });

            it("reverts", async function () {
              await expect(
                this.contracts.balanceSheet
                  .connect(this.signers.borrower)
                  .depositCollaterals(this.stubs.fyToken.address, collateralAmounts),
              ).to.be.reverted;
            });
          });

          describe("when the call to transfer the collateral succeeds", function () {
            beforeEach(async function () {
              for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
                await this.stubs.collaterals[i].mock.transferFrom
                .withArgs(this.accounts.borrower, this.contracts.balanceSheet.address, collateralAmounts[i])
                .returns(true);
              }
            });

            it("makes the collateral deposit", async function () {
              const oldVault = await this.contracts.balanceSheet.getVault(
                this.stubs.fyToken.address,
                this.accounts.borrower,
              );
              const oldFreeCollaterals: BigNumber[] = oldVault[1];
              await this.contracts.balanceSheet
                .connect(this.signers.borrower)
                .depositCollaterals(this.stubs.fyToken.address, collateralAmounts);
              const newVault = await this.contracts.balanceSheet.getVault(
                this.stubs.fyToken.address,
                this.accounts.borrower,
              );
              const newFreeCollaterals: BigNumber[] = newVault[1];

              for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
                expect(oldFreeCollaterals[i]).to.equal(newFreeCollaterals[i].sub(collateralAmounts[i]));
              }
            });

            it("emits a DepositCollaterals event", async function () {
              await expect(
                this.contracts.balanceSheet
                  .connect(this.signers.borrower)
                  .depositCollaterals(this.stubs.fyToken.address, collateralAmounts),
              )
                .to.emit(this.contracts.balanceSheet, "DepositCollaterals")
                .withArgs(
                  this.stubs.fyToken.address,
                  this.accounts.borrower,
                  this.stubs.collaterals.map((collateral) => (collateral.address)),
                  collateralAmounts,
                );
            });
          });
        });
      });
    });
  });
}
