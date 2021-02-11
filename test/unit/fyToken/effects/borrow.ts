import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { FintrollerErrors, FyTokenErrors, GenericErrors } from "../../../../helpers/errors";
import { contextForTimeDependentTests } from "../../../contexts";
import { fintrollerConstants, percentages, tokenAmounts } from "../../../../helpers/constants";
import { fyTokenConstants } from "../../../../helpers/constants";
import { increaseTime } from "../../../jsonRpc";
import { stubIsVaultOpen, stubVaultFreeCollaterals, stubVaultLockedCollaterals } from "../../stubs";

export default function shouldBehaveLikeBorrow(): void {
  const borrowAmount: BigNumber = tokenAmounts.oneHundred;
  const collateralAmounts: BigNumber[] = [tokenAmounts.ten, tokenAmounts.ten];

  describe("when the vault is not open", function () {
    beforeEach(async function () {
      await this.stubs.balanceSheet.mock.isVaultOpen
        .withArgs(this.contracts.fyToken.address, this.accounts.borrower)
        .returns(false);
    });

    it("reverts", async function () {
      await expect(this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount)).to.be.revertedWith(
        GenericErrors.VaultNotOpen,
      );
    });
  });

  describe("when the vault is open", function () {
    beforeEach(async function () {
      await stubIsVaultOpen.call(this, this.contracts.fyToken.address, this.accounts.borrower);
    });

    contextForTimeDependentTests("when the bond matured", function () {
      beforeEach(async function () {
        await increaseTime(fyTokenConstants.expirationTime);
      });

      it("reverts", async function () {
        await expect(this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount)).to.be.revertedWith(
          GenericErrors.BondMatured,
        );
      });
    });

    describe("when the bond did not mature", function () {
      describe("when the amount to borrow is zero", function () {
        it("reverts", async function () {
          await expect(this.contracts.fyToken.connect(this.signers.borrower).borrow(Zero)).to.be.revertedWith(
            FyTokenErrors.BorrowZero,
          );
        });
      });

      describe("when the amount to borrow is not zero", function () {
        describe("when the bond is not listed", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getBorrowAllowed
              .withArgs(this.contracts.fyToken.address)
              .revertsWithReason(FintrollerErrors.BondNotListed);
          });

          it("reverts", async function () {
            await expect(this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount)).to.be.revertedWith(
              FintrollerErrors.BondNotListed,
            );
          });
        });

        describe("when the bond is listed", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getBondCollateralizationRatio
              .withArgs(this.contracts.fyToken.address)
              .returns(fintrollerConstants.defaultCollateralizationRatio);
          });

          describe("when the fintroller does not allow borrows", function () {
            beforeEach(async function () {
              await this.stubs.fintroller.mock.getBorrowAllowed.withArgs(this.contracts.fyToken.address).returns(false);
            });

            it("reverts", async function () {
              await expect(
                this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount),
              ).to.be.revertedWith(FyTokenErrors.BorrowNotAllowed);
            });
          });

          describe("when the fintroller allows borrows", function () {
            beforeEach(async function () {
              await this.stubs.fintroller.mock.getBorrowAllowed.withArgs(this.contracts.fyToken.address).returns(true);
            });

            describe("when the borrow overflows the debt ceiling", function () {
              beforeEach(async function () {
                await this.stubs.fintroller.mock.getBondDebtCeiling
                  .withArgs(this.contracts.fyToken.address)
                  .returns(Zero);
              });

              it("reverts", async function () {
                await expect(
                  this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount),
                ).to.be.revertedWith(FyTokenErrors.BorrowDebtCeilingOverflow);
              });
            });

            describe("when the borrow does not overflow the debt ceiling", function () {
              beforeEach(async function () {
                await this.stubs.fintroller.mock.getBondDebtCeiling
                  .withArgs(this.contracts.fyToken.address)
                  .returns(tokenAmounts.oneHundred);
              });

              describe("when the caller did not deposit any collateral", function () {
                beforeEach(async function () {
                  /* The fyToken makes an internal call to this stubbed function. */
                  await this.stubs.balanceSheet.mock.getHypotheticalCollateralizationRatio
                    .withArgs(this.contracts.fyToken.address, this.accounts.borrower, [Zero], borrowAmount)
                    .returns(Zero);
                });

                it("reverts", async function () {
                  await expect(
                    this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount),
                  ).to.be.revertedWith(FyTokenErrors.BorrowLockedCollateralZero);
                });
              });

              describe("when the caller deposited collateral", function () {
                describe("when the caller did not lock the collateral", function () {
                  beforeEach(async function () {
                    /* Stub the value of the free collateral. */
                    await stubVaultFreeCollaterals.call(
                      this,
                      this.contracts.fyToken.address,
                      this.accounts.borrower,
                      collateralAmounts,
                    );

                    /* The fyToken makes an internal call to this stubbed function. */
                    await this.stubs.balanceSheet.mock.getHypotheticalCollateralizationRatio
                      .withArgs(this.contracts.fyToken.address, this.accounts.borrower, [Zero], borrowAmount)
                      .returns(Zero);
                  });

                  it("reverts", async function () {
                    await expect(
                      this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount),
                    ).to.be.revertedWith(FyTokenErrors.BorrowLockedCollateralZero);
                  });
                });

                describe("when the caller locked the collateral", function () {
                  beforeEach(async function () {
                    await stubVaultLockedCollaterals.call(
                      this,
                      this.contracts.fyToken.address,
                      this.accounts.borrower,
                      collateralAmounts,
                    );
                  });

                  describe("when the user is dangerously collateralized", function () {
                    const dangerousCollateralizationRatio: BigNumber = percentages.oneHundredAndTwenty;

                    beforeEach(async function () {
                      await this.stubs.balanceSheet.mock.getHypotheticalCollateralizationRatio
                        .withArgs(
                          this.contracts.fyToken.address,
                          this.accounts.borrower,
                          collateralAmounts,
                          borrowAmount,
                        )
                        .returns(dangerousCollateralizationRatio);
                    });

                    it("reverts", async function () {
                      await expect(
                        this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount),
                      ).to.be.revertedWith(GenericErrors.BelowCollateralizationRatio);
                    });
                  });

                  describe("when the user is safely collateralized", function () {
                    const safeCollateralizationRatio: BigNumber = percentages.oneThousand;

                    beforeEach(async function () {
                      await this.stubs.balanceSheet.mock.getHypotheticalCollateralizationRatio
                        .withArgs(
                          this.contracts.fyToken.address,
                          this.accounts.borrower,
                          collateralAmounts,
                          borrowAmount,
                        )
                        .returns(safeCollateralizationRatio);
                    });

                    describe("when the call to set the new vault debt does not succeed", function () {
                      beforeEach(async function () {
                        await this.stubs.balanceSheet.mock.setVaultDebt
                          .withArgs(this.contracts.fyToken.address, this.accounts.borrower, borrowAmount)
                          .returns(false);
                      });

                      it("reverts", async function () {
                        await expect(this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount)).to.be
                          .reverted;
                      });
                    });

                    describe("when the call to set the new vault debt succeeds", function () {
                      beforeEach(async function () {
                        await this.stubs.balanceSheet.mock.setVaultDebt
                          .withArgs(this.contracts.fyToken.address, this.accounts.borrower, borrowAmount)
                          .returns(true);
                      });

                      it("borrows fyTokens", async function () {
                        const oldBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.borrower);
                        await this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount);
                        const newBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.borrower);
                        expect(oldBalance).to.equal(newBalance.sub(borrowAmount));
                      });

                      it("emits a Borrow event", async function () {
                        await expect(this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount))
                          .to.emit(this.contracts.fyToken, "Borrow")
                          .withArgs(this.accounts.borrower, borrowAmount);
                      });

                      it("emits a Mint event", async function () {
                        await expect(this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount))
                          .to.emit(this.contracts.fyToken, "Mint")
                          .withArgs(this.accounts.borrower, borrowAmount);
                      });

                      it("emits a Transfer event", async function () {
                        await expect(this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount))
                          .to.emit(this.contracts.fyToken, "Transfer")
                          .withArgs(this.contracts.fyToken.address, this.accounts.borrower, borrowAmount);
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}
