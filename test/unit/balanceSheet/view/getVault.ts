import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

export default function shouldBehaveLikeGetVault(): void {
  describe("when the vault is not open", function () {
    it("retrieves the default values", async function () {
      const vault = await this.contracts.balanceSheet.getVault(this.stubs.fyToken.address, this.accounts.borrower);
      expect(vault[0]).to.equal(Zero); /* debt */
      expect(vault[1]).to.eql(Array(this.stubs.collaterals.length).fill(Zero)); /* freeCollaterals */
      expect(vault[2]).to.eql(Array(this.stubs.collaterals.length).fill(Zero)); /* lockedCollaterals */
      expect(vault[3]).to.equal(false); /* isOpen */
    });
  });

  describe("when the vault is open", function () {
    beforeEach(async function () {
      await this.contracts.balanceSheet.connect(this.signers.borrower).openVault(this.stubs.fyToken.address);
    });

    it("retrieves the storage properties of the vault", async function () {
      const vault = await this.contracts.balanceSheet.getVault(this.stubs.fyToken.address, this.accounts.borrower);
      expect(vault[0]).to.equal(Zero); /* debt */
      expect(vault[1]).to.eql(Array(this.stubs.collaterals.length).fill(Zero)); /* freeCollaterals */
      expect(vault[2]).to.eql(Array(this.stubs.collaterals.length).fill(Zero)); /* lockedCollaterals */
      expect(vault[3]).to.equal(true); /* isOpen */
    });
  });
}
