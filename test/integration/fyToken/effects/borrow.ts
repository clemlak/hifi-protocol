import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { tokenAmounts } from "../../../../helpers/constants";

export default function shouldBehaveLikeBorrow(): void {
  const borrowAmount: BigNumber = tokenAmounts.oneHundred;
  const collateralAmounts: BigNumber[] = [tokenAmounts.ten, BigNumber.from(0)];

  beforeEach(async function () {
    /* Open the vault. */
    await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.contracts.fyToken.address);

    /* List the bond in the Fintroller. */
    await this.contracts.fintroller.connect(this.signers.admin).listBond(this.contracts.fyToken.address);

    /* Allow borrow. */
    await this.contracts.fintroller.connect(this.signers.admin).setBorrowAllowed(this.contracts.fyToken.address, true);

    /* Set the debt ceiling to 1,000 fyDAI. */
    await this.contracts.fintroller
      .connect(this.signers.admin)
      .setBondDebtCeiling(this.contracts.fyToken.address, tokenAmounts.oneHundredThousand);

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
  });

  it("borrows fyTokens", async function () {
    const oldBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.borrower);
    await this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount);
    const newBalance: BigNumber = await this.contracts.fyToken.balanceOf(this.accounts.borrower);
    expect(oldBalance).to.equal(newBalance.sub(borrowAmount));
  });

  it("increases the debt of the caller", async function () {
    const oldDebt: BigNumber = await this.contracts.balanceSheet.getVaultDebt(
      this.contracts.fyToken.address,
      this.accounts.borrower,
    );
    await this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount);
    const newDebt: BigNumber = await this.contracts.balanceSheet.getVaultDebt(
      this.contracts.fyToken.address,
      this.accounts.borrower,
    );
    expect(oldDebt).to.equal(newDebt.sub(borrowAmount));
  });

  it("emits a SetVaultDebt event", async function () {
    await expect(this.contracts.fyToken.connect(this.signers.borrower).borrow(borrowAmount))
      .to.emit(this.contracts.balanceSheet, "SetVaultDebt")
      .withArgs(this.contracts.fyToken.address, this.accounts.borrower, Zero, borrowAmount);
  });
}
