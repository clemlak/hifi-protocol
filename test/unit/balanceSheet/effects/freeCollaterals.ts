import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { BalanceSheetErrors, GenericErrors } from "../../../../helpers/errors";
import { fintrollerConstants, tokenAmounts } from "../../../../helpers/constants";
import { Vault } from "../../../../types";

export default function shouldBehaveLikeLockCollaterals(): void {
  const depositCollateralAmounts: BigNumber[] = [tokenAmounts.ten, tokenAmounts.ten];

  describe("when the vault is not open", function () {
    it("reverts", async function () {
      await expect(
        this.contracts.balanceSheet
          .connect(this.signers.borrower)
          .freeCollaterals(this.stubs.fyToken.address, depositCollateralAmounts),
      ).to.be.revertedWith(GenericErrors.VaultNotOpen);
    });
  });

  describe("when the vault is open", function () {
    beforeEach(async function () {
      await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.stubs.fyToken.address);
    });

    describe("when the collateral amounts to free are zero", function () {
      it("reverts", async function () {
        await expect(
          this.contracts.balanceSheet.connect(this.signers.borrower).freeCollaterals(this.stubs.fyToken.address, [Zero, Zero]),
        ).to.be.revertedWith(BalanceSheetErrors.FreeCollateralsZero);
      });
    });

    describe("when the collateral amounts to free are not zero", function () {
      describe("when the caller did not deposit any collateral", function () {
        it("reverts", async function () {
          await expect(
            this.contracts.balanceSheet
              .connect(this.signers.borrower)
              .freeCollaterals(this.stubs.fyToken.address, depositCollateralAmounts),
          ).to.be.revertedWith(BalanceSheetErrors.InsufficientLockedCollaterals);
        });
      });

      describe("when the caller deposited collaterals", function () {
        beforeEach(async function () {
          /* Mock the required functions on the Fintroller and the collateral token stubs. */
          await this.stubs.fintroller.mock.getBondCollateralizationRatio
            .withArgs(this.stubs.fyToken.address)
            .returns(fintrollerConstants.defaultCollateralizationRatio);
          await this.stubs.fintroller.mock.getDepositCollateralAllowed
            .withArgs(this.stubs.fyToken.address)
            .returns(true);

          for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
            await this.stubs.collaterals[i].mock.transferFrom
              .withArgs(this.accounts.borrower, this.contracts.balanceSheet.address, depositCollateralAmounts[i])
              .returns(true);
          }

          /* Deposit 2 x 10 WETH. */
          await this.contracts.balanceSheet
            .connect(this.signers.borrower)
            .depositCollaterals(this.stubs.fyToken.address, depositCollateralAmounts);
        });

        describe("when the caller did not lock the collaterals", function () {
          it("reverts", async function () {
            await expect(
              this.contracts.balanceSheet
                .connect(this.signers.borrower)
                .freeCollaterals(this.stubs.fyToken.address, depositCollateralAmounts),
            ).to.be.revertedWith(BalanceSheetErrors.InsufficientLockedCollaterals);
          });
        });

        describe("when the caller locked the collaterals", function () {
          beforeEach(async function () {
            await this.contracts.balanceSheet
              .connect(this.signers.borrower)
              .lockCollaterals(this.stubs.fyToken.address, depositCollateralAmounts);
          });

          describe("when the caller does not have a debt", function () {
            it("it frees the collaterals", async function () {
              const oldVault: Vault = await this.contracts.balanceSheet.getVault(
                this.stubs.fyToken.address,
                this.accounts.borrower,
              );
              const oldFreeCollaterals: BigNumber[] = oldVault[1];
              const oldLockedCollaterals: BigNumber[] = oldVault[2];

              await this.contracts.balanceSheet
                .connect(this.signers.borrower)
                .freeCollaterals(this.stubs.fyToken.address, depositCollateralAmounts);

              const newVault: Vault = await this.contracts.balanceSheet.getVault(
                this.stubs.fyToken.address,
                this.accounts.borrower,
              );
              const newFreeCollaterals: BigNumber[] = newVault[1];
              const newLockedCollaterals: BigNumber[] = newVault[2];

              for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
                expect(oldFreeCollaterals[i]).to.equal(newFreeCollaterals[i].sub(depositCollateralAmounts[i]));
                expect(oldLockedCollaterals[i]).to.equal(newLockedCollaterals[i].add(depositCollateralAmounts[i]));
              }
            });
          });

          describe("when the caller has a debt", function () {
            beforeEach(async function () {
              await this.stubs.fintroller.mock.getBorrowAllowed.withArgs(this.stubs.fyToken.address).returns(true);
              /* The balance sheet will ask the oracle what's the value of 9 WETH collateral. */
            });

            describe("when the caller is dangerously collateralized", function () {
              beforeEach(async function () {
                /* This is a 150% collateralization ratio. We deposited 10 WETH and the oracle assumes 1 WETH = $100. */
                const debt: BigNumber = tokenAmounts.one.mul(666);

                /* Cannot call the usual `setVaultDebt` since the fyToken is stubbed. */
                await this.contracts.balanceSheet.__godMode_setVaultDebt(
                  this.stubs.fyToken.address,
                  this.accounts.borrower,
                  debt,
                );
              });

              it("reverts", async function () {
                const collateralAmounts: BigNumber[] = [tokenAmounts.one, tokenAmounts.one];
                await expect(
                  this.contracts.balanceSheet
                    .connect(this.signers.borrower)
                    .freeCollaterals(this.stubs.fyToken.address, collateralAmounts),
                ).to.be.revertedWith(GenericErrors.BelowCollateralizationRatio);
              });
            });

            describe("when the caller is safely over-collateralized", async function () {
              beforeEach(async function () {
                const debt: BigNumber = tokenAmounts.oneHundred;
                await this.contracts.balanceSheet.__godMode_setVaultDebt(
                  this.stubs.fyToken.address,
                  this.accounts.borrower,
                  debt,
                );
              });

              it("it frees the collateral", async function () {
                const oldVault: Vault = await this.contracts.balanceSheet.getVault(
                  this.stubs.fyToken.address,
                  this.accounts.borrower,
                );
                const oldFreeCollaterals: BigNumber[] = oldVault[1];
                const oldLockedCollaterals: BigNumber []= oldVault[2];

                const collateralAmounts: BigNumber[] = [tokenAmounts.one, tokenAmounts.one];
                await this.contracts.balanceSheet
                  .connect(this.signers.borrower)
                  .freeCollaterals(this.stubs.fyToken.address, collateralAmounts);

                const newVault: Vault = await this.contracts.balanceSheet.getVault(
                  this.stubs.fyToken.address,
                  this.accounts.borrower,
                );
                const newFreeCollaterals: BigNumber[] = newVault[1];
                const newLockedCollaterals: BigNumber[] = newVault[2];

                for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
                  expect(oldFreeCollaterals[i]).to.equal(newFreeCollaterals[i].sub(collateralAmounts[i]));
                  expect(oldLockedCollaterals[i]).to.equal(newLockedCollaterals[i].add(collateralAmounts[i]));
                }
              });

              it("emits a FreeCollaterals event", async function () {
                const collateralAmounts: BigNumber[] = [tokenAmounts.one, tokenAmounts.one];
                await expect(
                  this.contracts.balanceSheet
                    .connect(this.signers.borrower)
                    .freeCollaterals(this.stubs.fyToken.address, collateralAmounts),
                )
                  .to.emit(this.contracts.balanceSheet, "FreeCollaterals")
                  .withArgs(this.stubs.fyToken.address, this.accounts.borrower, this.stubs.collaterals.map((collateral) => (collateral.address)), collateralAmounts);
              });
            });
          });
        });
      });
    });
  });
}
