import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { OnePercent } from "../../../constants";

export default function shouldBehaveLikeGetBond(): void {
  /* Equivalent to 175% */
  const newCollateralizationRatioMantissa: BigNumber = OnePercent.mul(175);

  describe("when the bond is listed", function () {
    beforeEach(async function () {
      await this.fintroller._listBond(this.yToken.address);
      await this.fintroller.setCollateralizationRatio(this.yToken.address, newCollateralizationRatioMantissa);
    });

    it("should retrieve the bond data", async function () {
      const bondCollateralizationRatio: BigNumber = await this.fintroller.getBond(this.yToken.address);
      expect(bondCollateralizationRatio).to.equal(newCollateralizationRatioMantissa);
    });
  });

  describe("when the bond is not listed", function () {
    it("should retrieve a zero value", async function () {
      const bondCollateralizationRatio: BigNumber = await this.fintroller.getBond(this.yToken.address);
      expect(bondCollateralizationRatio).to.equal(Zero);
    });
  });
}
