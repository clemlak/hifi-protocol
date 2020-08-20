import { BigNumber } from "@ethersproject/bignumber";
import { Zero } from "@ethersproject/constants";
import { expect } from "chai";

import { FintrollerErrors, YTokenErrors } from "../../../helpers/errors";
import { OneHundredTokens, TenTokens } from "../../../helpers/constants";
import { contextForTimeDependentTests } from "../../../helpers/mochaContexts";
import { increaseTime } from "../../../helpers/jsonRpcHelpers";

export default function shouldBehaveLikeMint(): void {
  describe("when the vault is open", function () {
    beforeEach(async function () {
      await this.yToken.connect(this.brad).openVault();
    });

    describe("when the amount to mint is not zero", function () {
      describe("when the bond is listed", function () {
        beforeEach(async function () {
          await this.fintroller.connect(this.admin).listBond(this.yToken.address);
        });

        describe("when the bond did not mature", function () {
          describe("when the fintroller allows new mints", function () {
            beforeEach(async function () {
              await this.fintroller.connect(this.admin).setMintAllowed(this.yToken.address, true);
              await this.fintroller.connect(this.admin).setDepositAllowed(this.yToken.address, true);
            });

            /**
             * Write tests for the following cases:
             * - collateral value too small
             * - not enough liquidity in the guarantor pool
             */
            describe("when the user deposited collateral", function () {
              beforeEach(async function () {
                await this.collateral.connect(this.brad).approve(this.yToken.address, TenTokens);
                await this.yToken.connect(this.brad).depositCollateral(TenTokens);
              });

              describe("and locked it", function () {
                beforeEach(async function () {
                  await this.yToken.connect(this.brad).lockCollateral(TenTokens);
                });

                it("mints new yTokens", async function () {
                  await this.yToken.connect(this.brad).mint(OneHundredTokens);
                });

                it("increases the erc20 balance of the caller", async function () {
                  const preBalance: BigNumber = await this.yToken.balanceOf(this.bradAddress);
                  await this.yToken.connect(this.brad).mint(OneHundredTokens);
                  const postBalance: BigNumber = await this.yToken.balanceOf(this.bradAddress);
                  expect(preBalance).to.equal(postBalance.sub(OneHundredTokens));
                });

                it("emits a Mint event", async function () {
                  await expect(this.yToken.connect(this.brad).mint(OneHundredTokens))
                    .to.emit(this.yToken, "Mint")
                    .withArgs(this.bradAddress, OneHundredTokens);
                });

                it("emits a Transfer event", async function () {
                  await expect(this.yToken.connect(this.brad).mint(OneHundredTokens))
                    .to.emit(this.yToken, "Transfer")
                    .withArgs(this.yToken.address, this.bradAddress, OneHundredTokens);
                });
              });

              describe("but did not lock it", function () {
                it("reverts", async function () {
                  await expect(this.yToken.connect(this.brad).mint(OneHundredTokens)).to.be.revertedWith(
                    YTokenErrors.BelowCollateralizationRatio,
                  );
                });
              });
            });

            describe("when the user did not deposit any collateral", function () {
              it("reverts", async function () {
                await expect(this.yToken.connect(this.brad).mint(OneHundredTokens)).to.be.revertedWith(
                  YTokenErrors.BelowCollateralizationRatio,
                );
              });
            });
          });

          describe("when the fintroller does not allow new mints", function () {
            it("reverts", async function () {
              await expect(this.yToken.connect(this.brad).mint(OneHundredTokens)).to.be.revertedWith(
                YTokenErrors.MintNotAllowed,
              );
            });
          });
        });

        contextForTimeDependentTests("when the bond matured", function () {
          beforeEach(async function () {
            await increaseTime(this.scenario.yToken.expirationTime);
          });

          it("reverts", async function () {
            await expect(this.yToken.connect(this.brad).mint(OneHundredTokens)).to.be.revertedWith(
              YTokenErrors.BondMatured,
            );
          });
        });
      });

      describe("when the bond is not listed", function () {
        it("reverts", async function () {
          await expect(this.yToken.connect(this.brad).mint(OneHundredTokens)).to.be.revertedWith(
            FintrollerErrors.BondNotListed,
          );
        });
      });
    });

    describe("when the amount to mint is zero", function () {
      it("reverts", async function () {
        await expect(this.yToken.connect(this.brad).mint(Zero)).to.be.revertedWith(YTokenErrors.MintZero);
      });
    });
  });

  describe("when the vault is not open", function () {
    it("reverts", async function () {
      await expect(this.yToken.connect(this.brad).mint(OneHundredTokens)).to.be.revertedWith(YTokenErrors.VaultNotOpen);
    });
  });
}
