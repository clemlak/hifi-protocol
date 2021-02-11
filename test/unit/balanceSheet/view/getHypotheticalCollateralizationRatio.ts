import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { BalanceSheetErrors, ChainlinkOperatorErrors, GenericErrors } from "../../../../helpers/errors";
import { percentages, precisionScalars, tokenAmounts } from "../../../../helpers/constants";

export default function shouldBehaveLikeGetHypotheticalCollateralizationRatio(): void {
  const hypotheticalCollateralizationRatioMantissa: BigNumber = percentages.oneThousand.mul(BigNumber.from(2)); // TODO: Verify this ratio
  const lockedCollaterals: BigNumber[] = [tokenAmounts.ten, tokenAmounts.ten];
  const debt: BigNumber = tokenAmounts.oneHundred;

  describe("when the vault is not open", function () {
    it("reverts", async function () {
      await expect(
        this.contracts.balanceSheet
          .connect(this.signers.borrower)
          .getHypotheticalCollateralizationRatio(
            this.stubs.fyToken.address,
            this.accounts.borrower,
            lockedCollaterals,
            debt,
          ),
      ).to.be.revertedWith(GenericErrors.VaultNotOpen);
    });
  });

  describe("when the vault is not open", function () {
    beforeEach(async function () {
      await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.stubs.fyToken.address);
    });

    describe("when the locked collaterals are zero", function () {
      it("reverts", async function () {
        const zeroCollateralAmounts: BigNumber[] = [Zero, Zero];
        const hypotheticalCollateralizationRatioMantissa = await this.contracts.balanceSheet.getHypotheticalCollateralizationRatio(
          this.stubs.fyToken.address,
          this.accounts.borrower,
          zeroCollateralAmounts,
          debt,
        );
        expect(hypotheticalCollateralizationRatioMantissa).to.equal(Zero);
      });
    });

    describe("when the locked collaterals are not zero", function () {
      describe("when the debt is zero", function () {
        it("reverts", async function () {
          const zeroDebt: BigNumber = Zero;
          await expect(
            this.contracts.balanceSheet.getHypotheticalCollateralizationRatio(
              this.stubs.fyToken.address,
              this.accounts.borrower,
              lockedCollaterals,
              zeroDebt,
            ),
          ).to.be.revertedWith(BalanceSheetErrors.GetHypotheticalCollateralizationRatioDebtZero);
        });
      });

      describe("when the debt is not zero", function () {
        describe("when the collateral prices from the oracle is zero", function () {
          beforeEach(async function () {
            await this.stubs.oracle.mock.getAdjustedPrice
              .withArgs("WETH")
              .revertsWithReason(ChainlinkOperatorErrors.PriceZero);
          });

          it("reverts", async function () {
            await expect(
              this.contracts.balanceSheet.getHypotheticalCollateralizationRatio(
                this.stubs.fyToken.address,
                this.accounts.borrower,
                lockedCollaterals,
                debt,
              ),
            ).to.be.revertedWith(ChainlinkOperatorErrors.PriceZero);
          });
        });

        describe("when the collateral prices from the oracle are not zero", function () {
          describe("when the underlying price from the oracle is zero", function () {
            beforeEach(async function () {
              await this.stubs.oracle.mock.getAdjustedPrice
                .withArgs("DAI")
                .revertsWithReason(ChainlinkOperatorErrors.PriceZero);
            });

            it("reverts", async function () {
              await expect(
                this.contracts.balanceSheet.getHypotheticalCollateralizationRatio(
                  this.stubs.fyToken.address,
                  this.accounts.borrower,
                  lockedCollaterals,
                  debt,
                ),
              ).to.be.revertedWith(ChainlinkOperatorErrors.PriceZero);
            });
          });

          describe("when the underlying price from the oracle is not zero", function () {
            describe("when the collaterals have 8 decimals", function () {
              beforeEach(async function () {
                for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
                  await this.stubs.collaterals[i].mock.decimals.returns(BigNumber.from(8));
                }

                await this.stubs.fyToken.mock.collateralPrecisionScalars.returns(precisionScalars.tokenWith8Decimals);
              });

              it("retrieves the hypothetical collateralization ratio mantissa", async function () {
                const downscaledLockedCollaterals: BigNumber[] = [];

                for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
                  downscaledLockedCollaterals[i] = lockedCollaterals[i].div(precisionScalars.tokenWith8Decimals);
                }

                const contractHypotheticalCollateralizationRatioMantissa: BigNumber = await this.contracts.balanceSheet.getHypotheticalCollateralizationRatio(
                  this.stubs.fyToken.address,
                  this.accounts.borrower,
                  downscaledLockedCollaterals,
                  debt,
                );
                expect(contractHypotheticalCollateralizationRatioMantissa).to.equal(
                  hypotheticalCollateralizationRatioMantissa,
                );
              });
            });

            describe("when the collateral has 18 decimals", function () {
              beforeEach(async function () {
                for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
                  await this.stubs.collaterals[i].mock.decimals.returns(BigNumber.from(18));
                }

                await this.stubs.fyToken.mock.collateralPrecisionScalars.returns(precisionScalars.tokenWith18Decimals);
              });

              it("retrieves the hypothetical collateralization ratio mantissa", async function () {
                const contractHypotheticalCollateralizationRatioMantissa: BigNumber = await this.contracts.balanceSheet.getHypotheticalCollateralizationRatio(
                  this.stubs.fyToken.address,
                  this.accounts.borrower,
                  lockedCollaterals,
                  debt,
                );
                expect(contractHypotheticalCollateralizationRatioMantissa).to.equal(
                  hypotheticalCollateralizationRatioMantissa,
                );
              });
            });
          });
        });
      });
    });
  });
}
