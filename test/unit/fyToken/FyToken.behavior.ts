import shouldBehaveLikeConstructor from "./constructor";

import shouldBehaveLikeCollateralPrecisionScalarsGetter from "./view/collateralPrecisionScalars";
import shouldBehaveLikeBalanceSheetGetter from "./view/balanceSheet";
import shouldBehaveLikeCollateralsGetter from "./view/collaterals";
import shouldBehaveLikeExpirationTimeGetter from "./view/expirationTime";
import shouldBehaveLikeFintrollerGetter from "./view/fintroller";
import shouldBehaveLikeRedemptionPoolGetter from "./view/redemptionPool";
import shouldBehaveLikeUnderlyingGetter from "./view/underlying";
import shouldBehaveLikeIsFyTokenGetter from "./view/isFyToken";
import shouldBehaveLikeUnderlyingPrecisionScalarGetter from "./view/underlyingPrecisionScalars";

import shouldBehaveLikeBorrow from "./effects/borrow";
import shouldBehaveLikeBurn from "./effects/burn";
import shouldBehaveLikeLiquidateBorrow from "./effects/liquidateBorrow";
import shouldBehaveLikeMint from "./effects/mint";
import shouldBehaveLikeRepayBorrow from "./effects/repayBorrow";
import shouldBehaveLikeRepayBorrowBehalf from "./effects/repayBorrowBehalf";
import shouldBehaveLikeSetFintroller from "./effects/setFintroller";

export function shouldBehaveLikeFyToken(): void {
  describe("Constructor", function () {
    shouldBehaveLikeConstructor();
  });

  describe("View Functions", function () {
    describe("balanceSheet", function () {
      shouldBehaveLikeBalanceSheetGetter();
    });

    describe("collaterals", function () {
      shouldBehaveLikeCollateralsGetter();
    });

    describe("collateralPrecisionScalars", function () {
      shouldBehaveLikeCollateralPrecisionScalarsGetter();
    });

    describe("expirationTime", function () {
      shouldBehaveLikeExpirationTimeGetter();
    });

    describe("fintroller", function () {
      shouldBehaveLikeFintrollerGetter();
    });

    describe("isFyToken", function () {
      shouldBehaveLikeIsFyTokenGetter();
    });

    describe("redemptionPool", function () {
      shouldBehaveLikeRedemptionPoolGetter();
    });

    describe("underlying", function () {
      shouldBehaveLikeUnderlyingGetter();
    });

    describe("underlyingPrecisionScalar", function () {
      shouldBehaveLikeUnderlyingPrecisionScalarGetter();
    });
  });

  describe("Effects Functions", function () {
    describe("borrow", function () {
      shouldBehaveLikeBorrow();
    });

    describe("burn", function () {
      shouldBehaveLikeBurn();
    });

    describe("liquidateBorrow", function () {
      shouldBehaveLikeLiquidateBorrow();
    });

    describe("mint", function () {
      shouldBehaveLikeMint();
    });

    describe("repayBorrow", function () {
      shouldBehaveLikeRepayBorrow();
    });

    describe("repayBorrowBehalf", function () {
      shouldBehaveLikeRepayBorrowBehalf();
    });

    describe("setFintroller", function () {
      shouldBehaveLikeSetFintroller();
    });
  });
}
