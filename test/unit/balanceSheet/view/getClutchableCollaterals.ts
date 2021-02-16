import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { BalanceSheetErrors } from "../../../../helpers/errors";
import { percentages, precisionScalars, tokenAmounts } from "../../../../helpers/constants";

export default function shouldBehaveLikeGetClutchableCollaterals(): void {
  /* 0.5 = 50 (repay amount) * 1.1 (liquidation incentive) * 1.0 (underlying price) / 100 (collateral price) */
  const clutchableCollateralAmounts: BigNumber[] = [tokenAmounts.pointFiftyFive, tokenAmounts.pointFiftyFive];
  const repayAmount: BigNumber = tokenAmounts.fifty;

  describe("when the amount to repay is zero", function () {
    it("reverts", async function () {
      await expect(
        this.contracts.balanceSheet.getClutchableCollaterals(this.stubs.fyToken.address, Zero),
      ).to.be.revertedWith(BalanceSheetErrors.GetClutchableCollateralsZero);
    });
  });

  describe("when the amount to repay is not zero", function () {
    beforeEach(async function () {
      await this.stubs.fintroller.mock.liquidationIncentiveMantissa.returns(percentages.oneHundredAndTen);
    });

    describe("when the liquidation incentive is zero", function () {
      beforeEach(async function () {
        await this.stubs.fintroller.mock.liquidationIncentiveMantissa.returns(Zero);
      });

      it("retrieves zero", async function () {
        const clutchableCollateralAmounts: BigNumber[] = await this.contracts.balanceSheet.getClutchableCollaterals(
          this.stubs.fyToken.address,
          repayAmount,
        );

        expect(clutchableCollateralAmounts).to.eql(Array(this.stubs.collaterals.length).fill(Zero));
      });
    });

    describe("when the liquidation incentive is not zero", function () {
      describe("when the collaterals have 18 decimals", function () {
        beforeEach(async function () {
          for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
            await this.stubs.collaterals[i].mock.decimals.returns(BigNumber.from(18));
          }

          await this.stubs.fyToken.mock.collateralPrecisionScalars.returns(precisionScalars.tokenWith18Decimals);
        });

        it("retrieves the clutchable collateral amounts", async function () {
          const contractClutchableCollateralAmounts: BigNumber[] = await this.contracts.balanceSheet.getClutchableCollaterals(
            this.stubs.fyToken.address,
            repayAmount,
          );
          expect(contractClutchableCollateralAmounts).to.eql(clutchableCollateralAmounts);
        });
      });

      describe("when the collaterals have 8 decimals", function () {
        beforeEach(async function () {
          for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
            await this.stubs.collaterals[i].mock.decimals.returns(BigNumber.from(8));
          }

          await this.stubs.fyToken.mock.collateralPrecisionScalars.returns(precisionScalars.tokenWith8Decimals);
        });

        it("retrieves the downscaled clutchable collateral amounts", async function () {
          const downscaledClutchableCollateralAmounts: BigNumber[] = [];

          for (let i = 0; i < this.stubs.collaterals.length; i += 1) {
            downscaledClutchableCollateralAmounts[i] = clutchableCollateralAmounts[i].div(
              precisionScalars.tokenWith8Decimals,
            );
          }

          const contractClutchableCollateralAmounts: BigNumber[] = await this.contracts.balanceSheet.getClutchableCollaterals(
            this.stubs.fyToken.address,
            repayAmount,
          );
          expect(contractClutchableCollateralAmounts).to.eql(downscaledClutchableCollateralAmounts);
        });
      });
    });
  });
}
