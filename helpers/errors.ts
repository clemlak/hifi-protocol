export enum AdminErrors {
  NotAdmin = "ERR_NOT_ADMIN",
}

export enum BalanceSheetErrors {
  ClutchCollateralsNotAuthorized = "ERR_CLUTCH_COLLATERALS_NOT_AUTHORIZED",
  DepositCollateralsNotAllowed = "ERR_DEPOSIT_COLLATERALS_NOT_ALLOWED",
  DepositCollateralsZero = "ERR_DEPOSIT_COLLATERALS_ZERO",
  FreeCollateralsZero = "ERR_FREE_COLLATERALS_ZERO",
  GetClutchableCollateralsZero = "ERR_GET_CLUTCHABLE_COLLATERALS_ZERO",
  GetHypotheticalCollateralizationRatioDebtZero = "ERR_GET_HYPOTHETICAL_COLLATERALIZATION_RATIO_DEBT_ZERO",
  InsufficientFreeCollaterals = "ERR_INSUFFICIENT_FREE_COLLATERALS",
  InsufficientLockedCollaterals = "ERR_INSUFFICIENT_LOCKED_COLLATERALS",
  LockCollateralsZero = "ERR_LOCK_COLLATERALS_ZERO",
  OpenVaultFyTokenInspection = "ERR_OPEN_VAULT_FYTOKEN_INSPECTION",
  SetVaultDebtNotAuthorized = "ERR_SET_VAULT_DEBT_NOT_AUTHORIZED",
  WithdrawCollateralsZero = "ERR_WITHDRAW_COLLATERALS_ZERO",
}

export enum ChainlinkOperatorErrors {
  GetAdjustedPriceMathError = "ERR_GET_ADJUSTED_PRICE_MATH_ERROR",
  FeedIncorrectDecimals = "ERR_FEED_INCORRECT_DECIMALS",
  FeedNotSet = "ERR_FEED_NOT_SET",
  FeedSet = "ERR_FEED_SET",
  PriceZero = "ERR_PRICE_ZERO",
}

export enum FintrollerErrors {
  BondNotListed = "ERR_BOND_NOT_LISTED",
  ListBondFyTokenInspection = "ERR_LIST_BOND_FYTOKEN_INSPECTION",
  SetBondDebtCeilingUnderflow = "ERR_SET_BOND_DEBT_CEILING_UNDERFLOW",
  SetBondDebtCeilingZero = "ERR_SET_BOND_DEBT_CEILING_ZERO",
  SetBondCollateralizationRatioLowerBound = "ERR_SET_BOND_COLLATERALIZATION_RATIO_LOWER_BOUND",
  SetBondCollateralizationRatioUpperBound = "ERR_SET_BOND_COLLATERALIZATION_RATIO_UPPER_BOUND",
  SetLiquidationIncentiveLowerBound = "ERR_SET_LIQUIDATION_INCENTIVE_LOWER_BOUND",
  SetLiquidationIncentiveUpperBound = "ERR_SET_LIQUIDATION_INCENTIVE_UPPER_BOUND",
  SetOracleZeroAddress = "ERR_SET_ORACLE_ZERO_ADDRESS",
}

export enum FyTokenErrors {
  BorrowDebtCeilingOverflow = "ERR_BORROW_DEBT_CEILING_OVERFLOW",
  BorrowLockedCollateralZero = "ERR_BORROW_LOCKED_COLLATERAL_ZERO",
  BorrowNotAllowed = "ERR_BORROW_NOT_ALLOWED",
  BorrowZero = "ERR_BORROW_ZERO",
  BurnNotAuthorized = "ERR_BURN_NOT_AUTHORIZED",
  BurnZero = "ERR_BURN_ZERO",
  ConstructorCollateralDecimalsOverflow = "ERR_FYTOKEN_CONSTRUCTOR_COLLATERAL_DECIMALS_OVERFLOW",
  ConstructorCollateralDecimalsZero = "ERR_FYTOKEN_CONSTRUCTOR_COLLATERAL_DECIMALS_ZERO",
  ConstructorExpirationTimeNotValid = "ERR_FYTOKEN_CONSTRUCTOR_EXPIRATION_TIME_NOT_VALID",
  ConstructorUnderlyingDecimalsOverflow = "ERR_FYTOKEN_CONSTRUCTOR_UNDERLYING_DECIMALS_OVERFLOW",
  ConstructorUnderlyingDecimalsZero = "ERR_FYTOKEN_CONSTRUCTOR_UNDERLYING_DECIMALS_ZERO",
  LiquidateBorrowNotAllowed = "ERR_LIQUIDATE_BORROW_NOT_ALLOWED",
  LiquidateBorrowSelf = "ERR_LIQUIDATE_BORROW_SELF",
  LiquidateBorrowZero = "ERR_LIQUIDATE_BORROW_ZERO",
  MintNotAuthorized = "ERR_MINT_NOT_AUTHORIZED",
  MintZero = "ERR_MINT_ZERO",
  RepayBorrowInsufficientBalance = "ERR_REPAY_BORROW_INSUFFICIENT_BALANCE",
  RepayBorrowInsufficientDebt = "ERR_REPAY_BORROW_INSUFFICIENT_DEBT",
  RepayBorrowNotAllowed = "ERR_REPAY_BORROW_NOT_ALLOWED",
  RepayBorrowZero = "ERR_REPAY_BORROW_ZERO",
  SetFintrollerInspection = "ERR_SET_FINTROLLER_INSPECTION",
}

export enum GenericErrors {
  AccountNotUnderwater = "ERR_ACCOUNT_NOT_UNDERWATER",
  BelowCollateralizationRatio = "ERR_BELOW_COLLATERALIZATION_RATIO",
  BondMatured = "ERR_BOND_MATURED",
  BondNotMatured = "ERR_BOND_NOT_MATURED",
  NotInitialized = "ERR_NOT_INITALIZED",
  VaultOpen = "ERR_VAULT_OPEN",
  VaultNotOpen = "ERR_VAULT_NOT_OPEN",
}

export enum RedemptionPoolErrors {
  RedeemFyTokensInsufficientUnderlying = "ERR_REDEEM_FYTOKENS_INSUFFICIENT_UNDERLYING",
  RedeemFyTokensNotAllowed = "ERR_REDEEM_FYTOKENS_NOT_ALLOWED",
  RedeemFyTokensZero = "ERR_REDEEM_FYTOKENS_ZERO",
  SupplyUnderlyingNotAllowed = "ERR_SUPPLY_UNDERLYING_NOT_ALLOWED",
  SupplyUnderlyingZero = "ERR_SUPPLY_UNDERLYING_ZERO",
}
