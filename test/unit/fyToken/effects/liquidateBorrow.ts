import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { FintrollerErrors, FyTokenErrors, GenericErrors } from "../../../../helpers/errors";
import { contextForTimeDependentTests } from "../../../contexts";
import { fintrollerConstants, fyTokenConstants, tokenAmounts } from "../../../../helpers/constants";
import { increaseTime } from "../../../jsonRpc";
import { stubIsVaultOpen } from "../../stubs";

async function stubLiquidateBorrowInternalCalls(
  this: Mocha.Context,
  fyTokenAddress: string,
  newBorrowAmount: BigNumber,
  repayAmount: BigNumber,
  clutchedCollateralAmounts: BigNumber[],
): Promise<void> {
  await this.stubs.balanceSheet.mock.setVaultDebt
    .withArgs(fyTokenAddress, this.accounts.borrower, newBorrowAmount)
    .returns(true);
  await this.stubs.balanceSheet.mock.getClutchableCollaterals
    .withArgs(fyTokenAddress, repayAmount)
    .returns(clutchedCollateralAmounts);
  await this.stubs.balanceSheet.mock.clutchCollaterals
    .withArgs(fyTokenAddress, this.accounts.liquidator, this.accounts.borrower, clutchedCollateralAmounts)
    .returns(true);
}

export default function shouldBehaveLikeLiquidateBorrow(): void {
  const borrowAmount: BigNumber = tokenAmounts.oneHundred;
  const repayAmount: BigNumber = tokenAmounts.forty;
  const newBorrowAmount: BigNumber = borrowAmount.sub(repayAmount);

  describe("when the vault is not open", function () {
    beforeEach(async function () {
      await this.stubs.balanceSheet.mock.isVaultOpen
        .withArgs(this.contracts.fyToken.address, this.accounts.borrower)
        .returns(false);
    });

    it("reverts", async function () {
      await expect(
        this.contracts.fyToken.connect(this.signers.borrower).liquidateBorrow(this.accounts.borrower, repayAmount),
      ).to.be.revertedWith(GenericErrors.VaultNotOpen);
    });
  });

  describe("when the vault is open", function () {
    beforeEach(async function () {
      await stubIsVaultOpen.call(this, this.contracts.fyToken.address, this.accounts.borrower);
    });

    describe("when the caller is the borrower", function () {
      beforeEach(async function () {
        await this.stubs.fintroller.mock.getBondCollateralizationRatio
          .withArgs(this.contracts.fyToken.address)
          .returns(fintrollerConstants.defaultCollateralizationRatio);
        await this.stubs.balanceSheet.mock.getVaultDebt
          .withArgs(this.contracts.fyToken.address, this.accounts.borrower)
          .returns(borrowAmount);
        await this.contracts.fyToken.__godMode_mint(this.accounts.borrower, borrowAmount);
      });

      it("reverts", async function () {
        await expect(
          this.contracts.fyToken.connect(this.signers.borrower).liquidateBorrow(this.accounts.borrower, repayAmount),
        ).to.be.revertedWith(FyTokenErrors.LiquidateBorrowSelf);
      });
    });

    describe("when the caller is not the borrower", function () {
      describe("when the amount to repay is zero", function () {
        it("reverts", async function () {
          await expect(
            this.contracts.fyToken.connect(this.signers.liquidator).liquidateBorrow(this.accounts.borrower, Zero),
          ).to.be.revertedWith(FyTokenErrors.LiquidateBorrowZero);
        });
      });

      describe("when the amount to repay is not zero", function () {
        describe("when the bond is not listed", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getRepayBorrowAllowed
              .withArgs(this.contracts.fyToken.address)
              .revertsWithReason(FintrollerErrors.BondNotListed);
          });

          it("reverts", async function () {
            await expect(
              this.contracts.fyToken.connect(this.signers.borrower).repayBorrow(borrowAmount),
            ).to.be.revertedWith(FintrollerErrors.BondNotListed);
          });
        });

        describe("when the bond is listed", function () {
          beforeEach(async function () {
            await this.stubs.fintroller.mock.getBondCollateralizationRatio
              .withArgs(this.contracts.fyToken.address)
              .returns(fintrollerConstants.defaultCollateralizationRatio);
          });

          describe("when the fintroller does not allow liquidate borrow", function () {
            beforeEach(async function () {
              await this.stubs.fintroller.mock.getLiquidateBorrowAllowed
                .withArgs(this.contracts.fyToken.address)
                .returns(false);
            });

            it("reverts", async function () {
              await expect(
                this.contracts.fyToken
                  .connect(this.signers.liquidator)
                  .liquidateBorrow(this.accounts.borrower, repayAmount),
              ).to.be.revertedWith(FyTokenErrors.LiquidateBorrowNotAllowed);
            });
          });

          describe("when the fintroller allows liquidate borrow", function () {
            beforeEach(async function () {
              await this.stubs.fintroller.mock.getLiquidateBorrowAllowed
                .withArgs(this.contracts.fyToken.address)
                .returns(true);

              /* The fyToken makes an internal call to this function. */
              await this.stubs.fintroller.mock.getRepayBorrowAllowed
                .withArgs(this.contracts.fyToken.address)
                .returns(true);
            });

            describe("when the borrower does not have a debt", function () {
              beforeEach(async function () {
                /* Borrowers with no debt are never underwater. */
                await this.stubs.balanceSheet.mock.isAccountUnderwater
                  .withArgs(this.contracts.fyToken.address, this.accounts.borrower)
                  .returns(false);
                await this.stubs.balanceSheet.mock.getVaultDebt
                  .withArgs(this.contracts.fyToken.address, this.accounts.borrower)
                  .returns(Zero);
              });

              it("reverts", async function () {
                await expect(
                  this.contracts.fyToken
                    .connect(this.signers.liquidator)
                    .liquidateBorrow(this.accounts.borrower, repayAmount),
                ).to.be.revertedWith(GenericErrors.AccountNotUnderwater);
              });
            });

            describe("when the borrower has a debt", function () {
              const clutchableCollateralAmounts: BigNumber[] = [tokenAmounts.pointFiftyFive];

              beforeEach(async function () {
                /* User borrows 100 fyDAI. */
                await this.stubs.balanceSheet.mock.getVaultDebt
                  .withArgs(this.contracts.fyToken.address, this.accounts.borrower)
                  .returns(borrowAmount);
                await this.contracts.fyToken.__godMode_mint(this.accounts.borrower, borrowAmount);

                /* The fyToken makes internal calls to these stubbed functions. */
                await stubLiquidateBorrowInternalCalls.call(
                  this,
                  this.contracts.fyToken.address,
                  newBorrowAmount,
                  repayAmount,
                  clutchableCollateralAmounts,
                );
              });

              describe("when the account is not underwater", function () {
                beforeEach(async function () {
                  await this.stubs.balanceSheet.mock.isAccountUnderwater
                    .withArgs(this.contracts.fyToken.address, this.accounts.borrower)
                    .returns(false);
                });

                describe("when the bond did not mature", function () {
                  it("reverts", async function () {
                    await expect(
                      this.contracts.fyToken
                        .connect(this.signers.liquidator)
                        .liquidateBorrow(this.accounts.borrower, repayAmount),
                    ).to.be.revertedWith(GenericErrors.AccountNotUnderwater);
                  });
                });

                contextForTimeDependentTests("when the bond matured", function () {
                  beforeEach(async function () {
                    await increaseTime(fyTokenConstants.expirationTime);

                    /* Mint 100 fyDAI to the liquidator so he can repay the debt. */
                    await this.contracts.fyToken.__godMode_mint(this.accounts.liquidator, repayAmount);
                  });

                  it("liquidates the borrower", async function () {
                    const oldBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.liquidator);
                    await this.contracts.fyToken
                      .connect(this.signers.liquidator)
                      .liquidateBorrow(this.accounts.borrower, repayAmount);
                    const newBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.liquidator);
                    expect(oldBalance).to.equal(newBalance.add(repayAmount));
                  });
                });
              });

              describe("when the account is underwater", function () {
                beforeEach(async function () {
                  await this.stubs.balanceSheet.mock.isAccountUnderwater
                    .withArgs(this.contracts.fyToken.address, this.accounts.borrower)
                    .returns(true);
                });

                describe("when the caller does not have enough fyTokens", function () {
                  it("reverts", async function () {
                    await expect(
                      this.contracts.fyToken
                        .connect(this.signers.liquidator)
                        .liquidateBorrow(this.accounts.borrower, repayAmount),
                    ).to.be.revertedWith(FyTokenErrors.RepayBorrowInsufficientBalance);
                  });
                });

                describe("when the caller has enough fyTokens", function () {
                  beforeEach(async function () {
                    /* Mint 100 fyDAI to the liquidator so he can repay the debt. */
                    await this.contracts.fyToken.__godMode_mint(this.accounts.liquidator, repayAmount);
                  });

                  it("liquidates the borrower", async function () {
                    const oldBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.liquidator);
                    await this.contracts.fyToken
                      .connect(this.signers.liquidator)
                      .liquidateBorrow(this.accounts.borrower, repayAmount);
                    const newBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.liquidator);
                    expect(oldBalance).to.equal(newBalance.add(repayAmount));
                  });

                  it("emits a Burn event", async function () {
                    await expect(
                      this.contracts.fyToken
                        .connect(this.signers.liquidator)
                        .liquidateBorrow(this.accounts.borrower, repayAmount),
                    )
                      .to.emit(this.contracts.fyToken, "Burn")
                      .withArgs(this.accounts.liquidator, repayAmount);
                  });

                  it("emits a Transfer event", async function () {
                    await expect(
                      this.contracts.fyToken
                        .connect(this.signers.liquidator)
                        .liquidateBorrow(this.accounts.borrower, repayAmount),
                    )
                      .to.emit(this.contracts.fyToken, "Transfer")
                      .withArgs(this.accounts.liquidator, this.contracts.fyToken.address, repayAmount);
                  });

                  it("emits a RepayBorrow event", async function () {
                    await expect(
                      this.contracts.fyToken
                        .connect(this.signers.liquidator)
                        .liquidateBorrow(this.accounts.borrower, repayAmount),
                    )
                      .to.emit(this.contracts.fyToken, "RepayBorrow")
                      .withArgs(this.accounts.liquidator, this.accounts.borrower, repayAmount, newBorrowAmount);
                  });

                  it("emits a LiquidateBorrow event", async function () {
                    await expect(
                      this.contracts.fyToken
                        .connect(this.signers.liquidator)
                        .liquidateBorrow(this.accounts.borrower, repayAmount),
                    )
                      .to.emit(this.contracts.fyToken, "LiquidateBorrow")
                      .withArgs(
                        this.accounts.liquidator,
                        this.accounts.borrower,
                        repayAmount,
                        clutchableCollateralAmounts,
                      );
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
