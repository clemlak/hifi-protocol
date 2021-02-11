import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { BalanceSheetErrors, GenericErrors } from "../../../../helpers/errors";
import { tokenAmounts } from "../../../../helpers/constants";
import { Vault } from "../../../../types";

export default function shouldBehaveLikeLockCollaterals(): void {
  const depositCollateralAmounts: BigNumber[] = [tokenAmounts.ten, tokenAmounts.ten];

  describe("when the vault is open", function () {
    beforeEach(async function () {
      await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.stubs.fyToken.address);
    });

    describe("when the collateral amounts to lock are not zero", function () {
      describe("when the caller deposited collaterals", function () {
        beforeEach(async function () {
          await this.stubs.fintroller.mock.getDepositCollateralAllowed
            .withArgs(this.stubs.fyToken.address)
            .returns(true);

          for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
            await this.stubs.collaterals[i].mock.transferFrom
              .withArgs(this.accounts.borrower, this.contracts.balanceSheet.address, depositCollateralAmounts[i])
              .returns(true);
          }

          await this.contracts.balanceSheet
            .connect(this.signers.borrower)
            .depositCollaterals(this.stubs.fyToken.address, depositCollateralAmounts);
        });

        it("it locks the collaterals", async function () {
          const oldVault: Vault = await this.contracts.balanceSheet.getVault(
            this.stubs.fyToken.address,
            this.accounts.borrower,
          );
          const oldFreeCollaterals: BigNumber[] = oldVault[1];
          const oldLockedCollaterals: BigNumber[] = oldVault[2];

          await this.contracts.balanceSheet
            .connect(this.signers.borrower)
            .lockCollaterals(this.stubs.fyToken.address, depositCollateralAmounts);

          const newVault: Vault = await this.contracts.balanceSheet.getVault(
            this.stubs.fyToken.address,
            this.accounts.borrower,
          );
          const newFreeCollaterals: BigNumber[] = newVault[1];
          const newLockedCollaterals: BigNumber[] = newVault[2];

          for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
            expect(oldFreeCollaterals[i]).to.equal(newFreeCollaterals[i].add(depositCollateralAmounts[i]));
            expect(oldLockedCollaterals[i]).to.equal(newLockedCollaterals[i].sub(depositCollateralAmounts[i]));
          }
        });

        it("emits a LockCollaterals event", async function () {
          await expect(
            this.contracts.balanceSheet
              .connect(this.signers.borrower)
              .lockCollaterals(this.stubs.fyToken.address, depositCollateralAmounts),
          )
            .to.emit(this.contracts.balanceSheet, "LockCollaterals")
            .withArgs(
              this.stubs.fyToken.address,
              this.accounts.borrower,
              this.stubs.collaterals.map((collateral) => collateral.address),
              depositCollateralAmounts,
            );
        });
      });

      describe("when the caller did not deposit any collateral", function () {
        it("reverts", async function () {
          await expect(
            this.contracts.balanceSheet
              .connect(this.signers.borrower)
              .lockCollaterals(this.stubs.fyToken.address, depositCollateralAmounts),
          ).to.be.revertedWith(BalanceSheetErrors.InsufficientFreeCollaterals);
        });
      });
    });

    describe("when the collateral amounts to lock are zero", function () {
      it("reverts", async function () {
        await expect(
          this.contracts.balanceSheet.connect(this.signers.borrower).lockCollaterals(this.stubs.fyToken.address, [Zero, Zero]),
        ).to.be.revertedWith(BalanceSheetErrors.LockCollateralsZero);
      });
    });
  });

  describe("when the vault is not open", function () {
    it("reverts", async function () {
      await expect(
        this.contracts.balanceSheet
          .connect(this.signers.borrower)
          .lockCollaterals(this.stubs.fyToken.address, depositCollateralAmounts),
      ).to.be.revertedWith(GenericErrors.VaultNotOpen);
    });
  });
}
