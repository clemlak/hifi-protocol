import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

export default function shouldBehaveLikeGetVaultLockedCollaterals(): void {
  describe("when the bond is not open", function () {
    it("retrieves the default value", async function () {
      const lockedCollaterals: BigNumber[] = await this.contracts.balanceSheet.getVaultLockedCollaterals(
        this.stubs.fyToken.address,
        this.accounts.borrower,
      );
      expect(lockedCollaterals).to.eql(Array(this.stubs.collaterals.length).fill(Zero));
    });
  });

  describe("when the vault is open", function () {
    beforeEach(async function () {
      await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.stubs.fyToken.address);
    });

    it("retrieves the default value", async function () {
      const lockedCollaterals: BigNumber[]= await this.contracts.balanceSheet.getVaultLockedCollaterals(
        this.stubs.fyToken.address,
        this.accounts.borrower,
      );
      expect(lockedCollaterals).to.eql(Array(this.stubs.collaterals.length).fill(Zero));
    });
  });
}
