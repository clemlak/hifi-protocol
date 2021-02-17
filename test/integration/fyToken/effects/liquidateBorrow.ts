import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";

import { percentages, prices, tokenAmounts } from "../../../../helpers/constants";
import { BalanceSheetErrors } from "../../../../helpers/errors";

export default function shouldBehaveLikeLiquidateBorrow(): void {
  const borrowAmount: BigNumber = tokenAmounts.oneHundred;
  const collateralAmounts: BigNumber[] = [tokenAmounts.ten, BigNumber.from(0)];
  const repayAmount: BigNumber = tokenAmounts.fifty;

  let clutchableCollateralAmounts: BigNumber[];

  beforeEach(async function () {
    /* Open the vault. */
    await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.contracts.fyToken.address);

    /* List the bond in the Fintroller. */
    await this.contracts.fintroller.connect(this.signers.admin).listBond(this.contracts.fyToken.address);

    /* Allow liquidate borrow. */
    await this.contracts.fintroller
      .connect(this.signers.admin)
      .setLiquidateBorrowAllowed(this.contracts.fyToken.address, true);

    /* Allow repay borrow. */
    await this.contracts.fintroller
      .connect(this.signers.admin)
      .setRepayBorrowAllowed(this.contracts.fyToken.address, true);

    /* Set the debt ceiling to 1,000 fyDAI. */
    await this.contracts.fintroller
      .connect(this.signers.admin)
      .setBondDebtCeiling(this.contracts.fyToken.address, tokenAmounts.oneHundredThousand);

    /* Set the liquidation incentive to 110%. */
    await this.contracts.fintroller.connect(this.signers.admin).setLiquidationIncentive(percentages.oneHundredAndTen);

    /* Mint 10 WETH and approve the Balance Sheet to spend it all. */
    await this.contracts.collaterals[0].mint(this.accounts.borrower, collateralAmounts[0]);
    await this.contracts.collaterals[0]
      .connect(this.signers.borrower)
      .approve(this.contracts.balanceSheet.address, collateralAmounts[0]);

    /* Deposit the 10 WETH in the Balance Sheet. */
    await this.contracts.balanceSheet
      .connect(this.signers.borrower)
      .depositCollaterals(this.contracts.fyToken.address, collateralAmounts);

    /* Lock the 10 WETH in the vault. */
    await this.contracts.balanceSheet
      .connect(this.signers.borrower)
      .lockCollaterals(this.contracts.fyToken.address, collateralAmounts);

    /* Recall that the default price of 1 WETH is $100, which makes for a 1000% collateralization rate. */
    await this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount);

    /* Set the price of 1 WETH to $12 so that the new collateralization ratio becomes 120%. */
    await this.contracts.collateralPriceFeeds[0].setPrice(prices.twelveDollars);

    /* Mint 100 fyDAI to the liquidator so he can repay the debt. */
    await this.contracts.fyToken.__godMode_mint(this.accounts.liquidator, repayAmount);

    /* Calculate the amount of clutchable collateral. */
    clutchableCollateralAmounts = await this.contracts.balanceSheet.getClutchableCollaterals(
      this.contracts.fyToken.address,
      repayAmount,
    );
  });

  /**
   * This happens when the price of the collaterals fell so rapidly that there
   * isn't enough (in dollar terms) to compensate the liquidator.
   */
  describe("when there is not enough locked collaterals", function () {
    beforeEach(async function () {
      /* Set the price of 1 WETH = $1 so that the new collateralization ratio becomes 10%. */
      await this.contracts.collateralPriceFeeds[0].setPrice(prices.oneDollar);
    });

    it("reverts", async function () {
      await expect(
        this.contracts.fyToken.connect(this.signers.liquidator).liquidateBorrow(this.accounts.borrower, repayAmount),
      ).to.be.revertedWith(BalanceSheetErrors.InsufficientLockedCollaterals);
    });
  });

  describe("when there is enough locked collaterals", function () {
    it("liquidates the borrower", async function () {
      const oldBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.liquidator);
      await this.contracts.fyToken
        .connect(this.signers.liquidator)
        .liquidateBorrow(this.accounts.borrower, repayAmount);
      const newBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.liquidator);
      expect(oldBalance).to.equal(newBalance.add(repayAmount));
    });

    it("reduces the debt of the borrower", async function () {
      const oldDebt: BigNumber = await this.contracts.balanceSheet.getVaultDebt(
        this.contracts.fyToken.address,
        this.accounts.borrower,
      );
      await this.contracts.fyToken
        .connect(this.signers.liquidator)
        .liquidateBorrow(this.accounts.borrower, repayAmount);
      const newDebt: BigNumber = await this.contracts.balanceSheet.getVaultDebt(
        this.contracts.fyToken.address,
        this.accounts.borrower,
      );
      expect(oldDebt).to.equal(newDebt.add(repayAmount));
    });

    it("reduces the locked collaterals of the borrower", async function () {
      const oldLockedCollaterals: BigNumber[] = await this.contracts.balanceSheet.getVaultLockedCollaterals(
        this.contracts.fyToken.address,
        this.accounts.borrower,
      );
      await this.contracts.fyToken
        .connect(this.signers.liquidator)
        .liquidateBorrow(this.accounts.borrower, repayAmount);
      const newLockedCollaterals: BigNumber[] = await this.contracts.balanceSheet.getVaultLockedCollaterals(
        this.contracts.fyToken.address,
        this.accounts.borrower,
      );
      expect(oldLockedCollaterals[0]).to.equal(newLockedCollaterals[0].add(clutchableCollateralAmounts[0]));
    });

    it("transfers the clutched collaterals to the liquidator", async function () {
      const oldBalance: BigNumber = await this.contracts.collaterals[0].balanceOf(this.accounts.liquidator);
      await this.contracts.fyToken
        .connect(this.signers.liquidator)
        .liquidateBorrow(this.accounts.borrower, repayAmount);
      const newBalance: BigNumber = await this.contracts.collaterals[0].balanceOf(this.accounts.liquidator);
      expect(oldBalance).to.equal(newBalance.sub(clutchableCollateralAmounts[0]));
    });

    it("emits a ClutchCollateral event", async function () {
      await expect(
        this.contracts.fyToken.connect(this.signers.liquidator).liquidateBorrow(this.accounts.borrower, repayAmount),
      )
        .to.emit(this.contracts.balanceSheet, "ClutchCollaterals")
        .withArgs(
          this.contracts.fyToken.address,
          this.accounts.liquidator,
          this.accounts.borrower,
          clutchableCollateralAmounts,
        );
    });
  });
}
