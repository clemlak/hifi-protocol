import { Wallet } from "@ethersproject/wallet";

import { OneThousandTokens, TenTokens } from "../../constants";
import { deployFintroller, deploySuperMinter, deployYToken } from "../deployers";
import { mintAndDistributeTokens } from "../minters";
import { shouldBehaveLikeYToken } from "./YToken.behavior";

export function testYToken(wallets: Wallet[]): void {
  describe("YToken", function () {
    beforeEach(async function () {
      const deployer: Wallet = wallets[0];
      await deployFintroller.call(this, deployer);
      await deployYToken.call(this, deployer);

      await deploySuperMinter.call(this, deployer);

      /* Give all wallets 10 WETH */
      await mintAndDistributeTokens.call(this, this.collateral, TenTokens, wallets.slice(0, 5));
      /* Give all wallets 1,000 DAI */
      await mintAndDistributeTokens.call(this, this.underlying, OneThousandTokens, wallets.slice(0, 5));
    });

    shouldBehaveLikeYToken(wallets);
  });
}