import shouldBehaveLikeFintrollerGetter from "./view/fintroller";
import shouldBehaveLikeGetCurrentCollateralizationRatio from "./view/getCurrentCollateralizationRatio";
import shouldBehaveLikeGetHypotheticalCollateralizationRatio from "./view/getHypotheticalCollateralizationRatio";
import shouldBehaveLikeGetVault from "./view/getVault";
import shouldBehaveLikeGetVaultDebt from "./view/getVaultDebt";
import shouldBehaveLikeGetVaultLockedCollaterals from "./view/getVaultLockedCollaterals";
import shouldBehaveLikeIsAccountUnderwater from "./view/isAccountUnderwater";
import shouldBehaveLikeIsBalanceSheetGetter from "./view/isBalanceSheet";
import shouldBehaveLikeIsVaultOpenGetter from "./view/isVaultOpen";

import shouldBehaveLikeClutchCollaterals from "./effects/clutchCollaterals";
import shouldBehaveLikeDepositCollaterals from "./effects/depositCollaterals";
import shouldBehaveLikeFreeCollaterals from "./effects/freeCollaterals";
import shouldBehaveLikeGetClutchableCollaterals from "./view/getClutchableCollaterals";
import shouldBehaveLikeLockCollaterals from "./effects/lockCollaterals";
import shouldBehaveLikeOpenVault from "./effects/openVault";
import shouldBehaveLikeSetVaultDebt from "./effects/setVaultDebt";
import shouldBehaveLikeWithdrawCollaterals from "./effects/withdrawCollaterals";

export function shouldBehaveLikeBalanceSheet(): void {
  describe("View Functions", function () {
    describe("fintroller", function () {
      shouldBehaveLikeFintrollerGetter();
    });

    describe("getClutchableCollaterals", function () {
      shouldBehaveLikeGetClutchableCollaterals();
    });

    describe("getCurrentCollateralizationRatio", function () {
      shouldBehaveLikeGetCurrentCollateralizationRatio();
    });

    describe("getHypotheticalCollateralizationRatio", function () {
      shouldBehaveLikeGetHypotheticalCollateralizationRatio();
    });

    describe("getVault", function () {
      shouldBehaveLikeGetVault();
    });

    describe("getVaultDebt", function () {
      shouldBehaveLikeGetVaultDebt();
    });

    describe("getVaultLockedCollaterals", function () {
      shouldBehaveLikeGetVaultLockedCollaterals();
    });

    describe("isAccountUnderwater", function () {
      shouldBehaveLikeIsAccountUnderwater();
    });

    describe("isBalanceSheet", function () {
      shouldBehaveLikeIsBalanceSheetGetter();
    });

    describe("isVaultOpen", function () {
      shouldBehaveLikeIsVaultOpenGetter();
    });
  });

  describe("Effects Functions", function () {
    describe("clutchCollaterals", function () {
      shouldBehaveLikeClutchCollaterals();
    });

    describe("depositCollaterals", function () {
      shouldBehaveLikeDepositCollaterals();
    });

    describe("freeCollaterals", function () {
      shouldBehaveLikeFreeCollaterals();
    });

    describe("lockCollaterals", function () {
      shouldBehaveLikeLockCollaterals();
    });

    describe("openVault", function () {
      shouldBehaveLikeOpenVault();
    });

    describe("setVaultDebt", function () {
      shouldBehaveLikeSetVaultDebt();
    });

    describe("withdrawCollaterals", function () {
      shouldBehaveLikeWithdrawCollaterals();
    });
  });
}
