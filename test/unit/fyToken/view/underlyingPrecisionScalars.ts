import { BigNumber } from "@ethersproject/bignumber";
import { expect } from "chai";

import { FyToken } from "../../../../typechain/FyToken";
import { deployFyToken } from "../../../deployers";
import { fyTokenConstants, precisionScalars } from "../../../../helpers/constants";

export default function shouldBehaveLikeUnderlyingPrecisionScalarsGetter(): void {
  describe("when the underlying has 18 decimals", function () {
    beforeEach(async function () {
      await this.stubs.underlying.mock.decimals.returns(BigNumber.from(18));
    });

    it("retrieves 1", async function () {
      const underlyingPrecisionScalar: BigNumber = await this.contracts.fyToken.underlyingPrecisionScalar();
      expect(underlyingPrecisionScalar).to.equal(precisionScalars.tokenWith18Decimals);
    });
  });

  describe("when the underlying has 8 decimals", function () {
    beforeEach(async function () {
      await this.stubs.underlying.mock.decimals.returns(BigNumber.from(8));
    });

    it("retrieves 1.0e10", async function () {
      const fyToken: FyToken = await deployFyToken(
        this.signers.admin,
        fyTokenConstants.expirationTime,
        this.stubs.fintroller.address,
        this.stubs.balanceSheet.address,
        this.stubs.underlying.address,
        this.stubs.collaterals.map((collateral) => collateral.address),
      );
      const underlyingPrecisionScalar: BigNumber = await fyToken.underlyingPrecisionScalar();
      expect(underlyingPrecisionScalar).to.equal(precisionScalars.tokenWith8Decimals);
    });
  });
}
