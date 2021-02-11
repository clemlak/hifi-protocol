import { MockContract } from "ethereum-waffle";
import { One } from "@ethersproject/constants";
import { Signer } from "@ethersproject/abstract-signer";

import { ChainlinkOperator } from "../../typechain/ChainlinkOperator";
import { Fintroller } from "../../typechain/Fintroller";
import { GodModeBalanceSheet } from "../../typechain/GodModeBalanceSheet";
import { GodModeFyToken } from "../../typechain/GodModeFyToken";
import { GodModeRedemptionPool } from "../../typechain/GodModeRedemptionPool";

import {
  deployChainlinkOperator,
  deployFintroller,
  deployGodModeBalanceSheet,
  deployGodModeFyToken,
  deployGodModeRedemptionPool,
} from "../deployers";
import {
  deployStubBalanceSheet,
  deployStubChainlinkOperator,
  deployStubCollateral,
  deployStubCollateralPriceFeed,
  deployStubFintroller,
  deployStubRedemptionPool,
  deployStubFyToken,
  deployStubUnderlying,
} from "./stubs";
import { fyTokenConstants } from "../../helpers/constants";

type UnitFixtureBalanceSheetReturnType = {
  balanceSheet: GodModeBalanceSheet;
  collaterals: MockContract[];
  fintroller: MockContract;
  oracle: MockContract;
  underlying: MockContract;
  fyToken: MockContract;
};

export async function unitFixtureBalanceSheet(signers: Signer[]): Promise<UnitFixtureBalanceSheetReturnType> {
  const deployer: Signer = signers[0];

  const collateralABC: MockContract = await deployStubCollateral(deployer);
  const collateralXYZ: MockContract = await deployStubCollateral(deployer);

  const collaterals = [collateralABC, collateralXYZ];
  const underlying: MockContract = await deployStubUnderlying(deployer);

  const oracle: MockContract = await deployStubChainlinkOperator(deployer);
  const fintroller: MockContract = await deployStubFintroller(deployer);
  await fintroller.mock.oracle.returns(oracle.address);

  const fyToken: MockContract = await deployStubFyToken(deployer);
  await fyToken.mock.getCollaterals.returns([collateralABC.address, collateralXYZ.address]);
  await fyToken.mock.collateralPrecisionScalars.returns(One); // Both collaterals share the same decimals
  await fyToken.mock.underlying.returns(underlying.address);
  await fyToken.mock.underlyingPrecisionScalar.returns(One);

  const balanceSheet: GodModeBalanceSheet = await deployGodModeBalanceSheet(deployer, fintroller.address);
  return { balanceSheet, collaterals, fintroller, oracle, underlying, fyToken };
}

type UnitFixtureChainlinkOperatorReturnType = {
  collateral: MockContract;
  collateralPriceFeed: MockContract;
  oracle: ChainlinkOperator;
};

export async function unitFixtureChainlinkOperator(signers: Signer[]): Promise<UnitFixtureChainlinkOperatorReturnType> {
  const deployer: Signer = signers[0];
  const collateral: MockContract = await deployStubCollateral(deployer);
  const collateralPriceFeed: MockContract = await deployStubCollateralPriceFeed(deployer);
  const oracle: ChainlinkOperator = await deployChainlinkOperator(deployer);
  return { collateral, collateralPriceFeed, oracle };
}

type UnitFixtureFintrollerReturnType = {
  fintroller: Fintroller;
  fyToken: MockContract;
  oracle: MockContract;
};

export async function unitFixtureFintroller(signers: Signer[]): Promise<UnitFixtureFintrollerReturnType> {
  const deployer: Signer = signers[0];
  const oracle: MockContract = await deployStubChainlinkOperator(deployer);
  const fyToken: MockContract = await deployStubFyToken(deployer);
  const fintroller: Fintroller = await deployFintroller(deployer);
  return { fintroller, fyToken, oracle };
}

type UnitFixtureFyTokenReturnType = {
  balanceSheet: MockContract;
  collaterals: MockContract[];
  fintroller: MockContract;
  fyToken: GodModeFyToken;
  oracle: MockContract;
  redemptionPool: MockContract;
  underlying: MockContract;
};

export async function unitFixtureFyToken(signers: Signer[]): Promise<UnitFixtureFyTokenReturnType> {
  const deployer: Signer = signers[0];

  const oracle: MockContract = await deployStubChainlinkOperator(deployer);
  const fintroller: MockContract = await deployStubFintroller(deployer);
  await fintroller.mock.oracle.returns(oracle.address);

  const balanceSheet: MockContract = await deployStubBalanceSheet(deployer);
  const underlying: MockContract = await deployStubUnderlying(deployer);
  const collateralABC: MockContract = await deployStubCollateral(deployer);
  const collateralXYZ: MockContract = await deployStubCollateral(deployer);
  const fyToken: GodModeFyToken = await deployGodModeFyToken(
    deployer,
    fyTokenConstants.expirationTime,
    fintroller.address,
    balanceSheet.address,
    underlying.address,
    [collateralABC.address, collateralXYZ.address],
  );

  /**
   * The fyToken initializes the Redemption Pool in its constructor, but we don't want
   * it for our unit tests. With help from the god-mode, we override the Redemption Pool
   * with a mock contract.
   */
  const redemptionPool: MockContract = await deployStubRedemptionPool(deployer);
  await fyToken.__godMode__setRedemptionPool(redemptionPool.address);

  return { balanceSheet, collaterals: [collateralABC, collateralXYZ], fintroller, oracle, redemptionPool, underlying, fyToken };
}

type UnitFixtureRedemptionPoolReturnType = {
  fintroller: MockContract;
  redemptionPool: GodModeRedemptionPool;
  underlying: MockContract;
  fyToken: MockContract;
};

export async function unitFixtureRedemptionPool(signers: Signer[]): Promise<UnitFixtureRedemptionPoolReturnType> {
  const deployer: Signer = signers[0];

  const fintroller: MockContract = await deployStubFintroller(deployer);
  const underlying: MockContract = await deployStubUnderlying(deployer);

  const fyToken: MockContract = await deployStubFyToken(deployer);
  await fyToken.mock.underlying.returns(underlying.address);
  await fyToken.mock.underlyingPrecisionScalar.returns(One);

  const redemptionPool: GodModeRedemptionPool = await deployGodModeRedemptionPool(
    deployer,
    fintroller.address,
    fyToken.address,
  );
  return { fintroller, redemptionPool, underlying, fyToken };
}
