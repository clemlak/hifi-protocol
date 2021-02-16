/* SPDX-License-Identifier: LGPL-3.0-or-later */
pragma solidity ^0.7.0;

import "@paulrberg/contracts/access/Admin.sol";
import "@paulrberg/contracts/math/Exponential.sol";
import "@paulrberg/contracts/token/erc20/Erc20Interface.sol";
import "@paulrberg/contracts/token/erc20/SafeErc20.sol";
import "@paulrberg/contracts/utils/ReentrancyGuard.sol";

import "./BalanceSheetInterface.sol";
import "./FintrollerInterface.sol";
import "./FyTokenInterface.sol";
import "./oracles/ChainlinkOperatorInterface.sol";

/**
 * @title BalanceSheet
 * @author Hifi
 * @notice Manages the debt vault for all fyTokens.
 */
contract BalanceSheet is
    ReentrancyGuard, /* no depedency */
    BalanceSheetInterface, /* one dependency */
    Admin, /* two dependencies */
    Exponential /* two dependencies */
{
    using SafeErc20 for Erc20Interface;

    modifier isVaultOpenForMsgSender(FyTokenInterface fyToken) {
        require(vaults[address(fyToken)][msg.sender].isOpen, "ERR_VAULT_NOT_OPEN");
        _;
    }

    /**
     * @param fintroller_ The address of the Fintroller contract.
     */
    constructor(FintrollerInterface fintroller_) Admin() {
        /* Set the fyToken contract and sanity check it. */
        fintroller = fintroller_;
        fintroller.isFintroller();
    }

    /**
     * CONSTANT FUNCTIONS
     */

    struct GetClutchableCollateralsLocalVars {
        MathError mathErr;
        Exp[] clutchableCollateralAmountsUpscaled;
        uint256[] clutchableCollateralAmounts;
        uint256[] collateralPrecisionScalars;
        uint256[] collateralPricesUpscaled;
        uint256 liquidationIncentiveMantissa;
        Exp numerator;
        uint256 underlyingPriceUpscaled;
    }

    /* FIXME: Fix the algorithm of this function to make it work with the multi-collaterization */
    /**
     * @notice Determines the collateral amounts that can be clutched when liquidating a borrow.
     *
     * @dev The formula applied is almost the same as a single-collateralized borrow, except that it will be ran through
     * all the deposited collaterals until the right value has been clutched (the order of priority of the collaterals is
     * determined when the fyToken is created):
     *
     * clutchedCollateral = repayAmount * liquidationIncentive * underlyingPriceUsd / collateralPriceUsd
     *
     * Requirements:
     *
     * - `repayAmount` must be non-zero.
     *
     * @param fyToken The fyToken to make the query against.
     * @param repayAmount The amount of fyTokens to repay.
     * @return The amount of clutchable collaterals as an array of uint256, specified in the collateral decimals.
     */
    function getClutchableCollaterals(FyTokenInterface fyToken, uint256 repayAmount)
        external
        view
        override
        returns (uint256[] memory)
    {
        GetClutchableCollateralsLocalVars memory vars;
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();
        vars.clutchableCollateralAmounts = new uint256[](collaterals.length);

        /* Avoid the zero edge cases. */
        require(repayAmount > 0, "ERR_GET_CLUTCHABLE_COLLATERALS_ZERO");

        /* When the liquidation incentive is zero, the end result would be zero anyways. */
        vars.liquidationIncentiveMantissa = fintroller.liquidationIncentiveMantissa();
        if (vars.liquidationIncentiveMantissa == 0) {
            return vars.clutchableCollateralAmounts;
        }

        /* Grab the upscaled USD price of the underlying. */
        ChainlinkOperatorInterface oracle = fintroller.oracle();
        vars.underlyingPriceUpscaled = oracle.getAdjustedPrice(fyToken.underlying().symbol());

        vars.collateralPricesUpscaled = new uint256[](collaterals.length);
        vars.clutchableCollateralAmountsUpscaled = new Exp[](collaterals.length);
        vars.collateralPrecisionScalars = new uint256[](collaterals.length);

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            /* Grab the upscaled USD price of the collateral. */
            vars.collateralPricesUpscaled[i] = oracle.getAdjustedPrice(collaterals[i].symbol());

            /* Calculate the top part of the equation. */
            (vars.mathErr, vars.numerator) = mulExp3(
                Exp({ mantissa: repayAmount }),
                Exp({ mantissa: vars.liquidationIncentiveMantissa }),
                Exp({ mantissa: vars.underlyingPriceUpscaled })
            );
            require(vars.mathErr == MathError.NO_ERROR, "ERR_GET_CLUTCHABLE_COLLATERALS_MATH_ERROR");

            /* Calculate the mantissa form of the clutched collateral amount. */
            (vars.mathErr, vars.clutchableCollateralAmountsUpscaled[i]) = divExp(
                vars.numerator,
                Exp({ mantissa: vars.collateralPricesUpscaled[i] })
            );
            require(vars.mathErr == MathError.NO_ERROR, "ERR_GET_CLUTCHABLE_COLLATERALS_MATH_ERROR");

            /* If the precision scalar is not 1, calculate the final form of the clutched collateral amount. */
            vars.collateralPrecisionScalars[i] = fyToken.collateralPrecisionScalars(address(collaterals[i]));
            if (vars.collateralPrecisionScalars[i] != 1) {
                (vars.mathErr, vars.clutchableCollateralAmounts[i]) = divUInt(
                    vars.clutchableCollateralAmountsUpscaled[i].mantissa,
                    vars.collateralPrecisionScalars[i]
                );
                require(vars.mathErr == MathError.NO_ERROR, "ERR_GET_CLUTCHABLE_COLLATERALS_MATH_ERROR");
            } else {
                vars.clutchableCollateralAmounts[i] = vars.clutchableCollateralAmountsUpscaled[i].mantissa;
            }
        }

        return vars.clutchableCollateralAmounts;
    }

    /**
     * @notice Determines the current collateralization ratio for the given borrower account.
     * @param fyToken The fyToken to make the query against.
     * @param borrower The borrower account to make the query against.
     * @return A quotient if locked collaterals is non-zero, otherwise zero.
     */
    function getCurrentCollateralizationRatio(FyTokenInterface fyToken, address borrower)
        public
        view
        override
        returns (uint256)
    {
        /* TODO: Verify the effect of this being "storage" instead of "memory" */
        Vault storage vault = vaults[address(fyToken)][borrower];

        Erc20Interface[] memory collaterals = fyToken.getCollaterals();
        uint256[] memory lockedCollaterals = new uint256[](collaterals.length);

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            lockedCollaterals[i] = vault.lockedCollaterals[address(collaterals[i])];
        }

        return getHypotheticalCollateralizationRatio(fyToken, borrower, lockedCollaterals, vault.debt);
    }

    struct GetHypotheticalAccountLiquidityLocalVars {
        MathError mathErr;
        uint256[] collateralPricesUpscaled;
        uint256[] collateralPrecisionScalars;
        uint256 collateralizationRatioMantissa;
        Exp debtValueUsd;
        Exp hypotheticalCollateralizationRatio;
        Exp[] lockedCollateralValuesUsd;
        uint256[] lockedCollateralsUpscaled;
        uint256 oraclePricePrecisionScalar;
        uint256 underlyingPriceUpscaled;
        uint256 underlyingPrecisionScalar;
        Exp totalLockedCollateralValueUsd;
        uint256 totalLockedAmount;
    }

    /**
     * @notice Determines the hypothetical collateralization ratio for the given locked
     * collaterals and debt, at the current prices provided by the oracle.
     *
     * @dev The formula applied: collateralizationRatio = totalLockedCollateralValueUsd / debtValueUsd
     *
     * Requirements:
     *
     * - The vault must be open.
     * - `debt` must be non-zero.
     * - The oracle prices must be non-zero.
     *
     * @param fyToken The fyToken for which to make the query against.
     * @param borrower The borrower account for which to make the query against.
     * @param lockedCollateralAmounts The hypothetical locked collateral amounts.
     * @param debt The hypothetical debt.
     * @return The hypothetical collateralization ratio as a percentage mantissa if locked
     * collateral is non-zero, otherwise zero.
     */
    function getHypotheticalCollateralizationRatio(
        FyTokenInterface fyToken,
        address borrower,
        uint256[] memory lockedCollateralAmounts,
        uint256 debt
    ) public view override returns (uint256) {
        GetHypotheticalAccountLiquidityLocalVars memory vars;

        /* If the vault is not open, a hypothetical collateralization ratio cannot be calculated. */
        require(vaults[address(fyToken)][borrower].isOpen, "ERR_VAULT_NOT_OPEN");

        /* Grab the collaterals for the fyToken */
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        require(
            collaterals.length == lockedCollateralAmounts.length,
            "ERR_GET_HYPOTHETICAL_COLLATERALIZATION_RATIO_AMOUNTS_ERROR"
        );

        /* Avoid the zero edge cases. */
        for (uint256 i = 0; i < collaterals.length; i += 1) {
            (vars.mathErr, vars.totalLockedAmount) = addUInt(vars.totalLockedAmount, lockedCollateralAmounts[i]);
            require(vars.mathErr == MathError.NO_ERROR, "ERR_GET_HYPOTHETICAL_COLLATERALIZATION_RATIO_MATH_ERROR");
        }

        if (vars.totalLockedAmount == 0) {
            return 0;
        }

        require(debt > 0, "ERR_GET_HYPOTHETICAL_COLLATERALIZATION_RATIO_DEBT_ZERO");

        ChainlinkOperatorInterface oracle = fintroller.oracle();

        /* Grab the upscaled USD price of the underlying. */
        vars.underlyingPriceUpscaled = oracle.getAdjustedPrice(fyToken.underlying().symbol());

        /* Grab the upscaled USD price of the collaterals. */
        vars.collateralPricesUpscaled = new uint256[](collaterals.length);

        /* TODO: Improve all these loops, maybe stick them together? */
        for (uint256 i = 0; i < collaterals.length; i += 1) {
            vars.collateralPricesUpscaled[i] = oracle.getAdjustedPrice(collaterals[i].symbol());
        }

        vars.collateralPrecisionScalars = new uint256[](collaterals.length);
        vars.lockedCollateralsUpscaled = new uint256[](collaterals.length);

        /* Upscale the collaterals, which can have any precision, to mantissa precision. */
        for (uint256 i = 0; i < collaterals.length; i += 1) {
            vars.collateralPrecisionScalars[i] = fyToken.collateralPrecisionScalars(address(collaterals[i]));

            if (vars.collateralPrecisionScalars[i] != 1) {
                (vars.mathErr, vars.lockedCollateralsUpscaled[i]) = mulUInt(lockedCollateralAmounts[i], vars.collateralPrecisionScalars[i]);
                require(vars.mathErr == MathError.NO_ERROR, "ERR_GET_HYPOTHETICAL_COLLATERALIZATION_RATIO_MATH_ERROR");
            } else {
                vars.lockedCollateralsUpscaled[i] = lockedCollateralAmounts[i];
            }
        }

        vars.lockedCollateralValuesUsd = new Exp[](collaterals.length);

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            /* Calculate the USD value of the collateral. */
            (vars.mathErr, vars.lockedCollateralValuesUsd[i]) = mulExp(
                Exp({ mantissa: vars.lockedCollateralsUpscaled[i] }),
                Exp({ mantissa: vars.collateralPricesUpscaled[i] })
            );
            require(vars.mathErr == MathError.NO_ERROR, "ERR_GET_HYPOTHETICAL_COLLATERALIZATION_RATIO_MATH_ERROR");
        }

        /* Calculate the total value of the collaterals */
        for (uint256 i = 0; i < collaterals.length; i += 1) {
            (vars.mathErr, vars.totalLockedCollateralValueUsd) = addExp(
                vars.totalLockedCollateralValueUsd,
                vars.lockedCollateralValuesUsd[i]
            );

            require(vars.mathErr == MathError.NO_ERROR, "ERR_GET_HYPOTHETICAL_COLLATERALIZATION_RATIO_MATH_ERROR");
        }

        /* Calculate the USD value of the debt. */
        (vars.mathErr, vars.debtValueUsd) = mulExp(
            Exp({ mantissa: debt }),
            Exp({ mantissa: vars.underlyingPriceUpscaled })
        );
        require(vars.mathErr == MathError.NO_ERROR, "ERR_GET_HYPOTHETICAL_COLLATERALIZATION_RATIO_MATH_ERROR");

        /**
         * Calculate the collateralization ratio by dividing the USD value of the hypothetical locked collateral by
         * the USD value of the debt.
         */
        (vars.mathErr, vars.hypotheticalCollateralizationRatio) = divExp(
            vars.totalLockedCollateralValueUsd,
            vars.debtValueUsd
        );
        require(vars.mathErr == MathError.NO_ERROR, "ERR_GET_HYPOTHETICAL_COLLATERALIZATION_RATIO_MATH_ERROR");

        return vars.hypotheticalCollateralizationRatio.mantissa;
    }

    /**
     * @notice Reads the storage properties of a vault.
     * @return uint256 debt
     * @return uint256[] freeCollaterals
     * @return uint256[] lockedCollaterals
     * @return bool isOpen
     */
    function getVault(FyTokenInterface fyToken, address borrower)
        external
        view
        override
        returns (
            uint256,
            uint256[] memory,
            uint256[] memory,
            bool
        )
    {
        Vault storage vault = vaults[address(fyToken)][borrower];
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();
        uint256[] memory freeCollateralsInVault = new uint256[](collaterals.length);
        uint256[] memory lockedCollaterals = new uint256[](collaterals.length);

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            freeCollateralsInVault[i] = vault.freeCollaterals[address(collaterals[i])];
            lockedCollaterals[i] = vault.lockedCollaterals[address(collaterals[i])];
        }

        return (
            vaults[address(fyToken)][borrower].debt,
            freeCollateralsInVault,
            lockedCollaterals,
            vaults[address(fyToken)][borrower].isOpen
        );
    }

    /**
     * @notice Reads the debt held by the given account.
     * @return The debt held by the borrower, as an uint256.
     */
    function getVaultDebt(FyTokenInterface fyToken, address borrower) external view override returns (uint256) {
        return vaults[address(fyToken)][borrower].debt;
    }

    /**
     * @notice Reads the collaterals (addresses and amounts) that the given borrower account locked in the vault.
     * @return The collaterals locked in the vault by the borrower, as address[] and uint256[]
     */
    function getVaultLockedCollaterals(FyTokenInterface fyToken, address borrower)
        external
        view
        override
        returns (
            uint256[] memory
        )
    {
        Vault storage vault = vaults[address(fyToken)][borrower];
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();
        uint256[] memory lockedCollaterals = new uint256[](collaterals.length);

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            lockedCollaterals[i] = vault.lockedCollaterals[address(collaterals[i])];
        }

        return lockedCollaterals;
    }

    /**
     * @notice Checks whether the borrower account can be liquidated or not.
     * @param fyToken The fyToken for which to make the query against.
     * @param borrower The borrower account for which to make the query against.
     * @return true = is underwater, otherwise not.
     */
    function isAccountUnderwater(FyTokenInterface fyToken, address borrower) external view override returns (bool) {
        Vault storage vault = vaults[address(fyToken)][borrower];
        if (!vault.isOpen || vault.debt == 0) {
            return false;
        }
        uint256 currentCollateralizationRatioMantissa = getCurrentCollateralizationRatio(fyToken, borrower);
        uint256 thresholdCollateralizationRatioMantissa = fintroller.getBondCollateralizationRatio(fyToken);
        return currentCollateralizationRatioMantissa < thresholdCollateralizationRatioMantissa;
    }

    /**
     * @notice Checks whether the borrower account has a vault opened for a particular fyToken.
     */
    function isVaultOpen(FyTokenInterface fyToken, address borrower) external view override returns (bool) {
        return vaults[address(fyToken)][borrower].isOpen;
    }

    /**
     * NON-CONSTANT FUNCTIONS
     */

    /**
     * @notice Transfers the collaterals from the borrower's vault to the liquidator account.
     *
     * @dev Emits a {ClutchCollaterals} event.
     *
     * Requirements:
     *
     * - Can only be called by the fyToken.
     * - There must be enough collaterals in the borrower's vault.
     *
     * @param fyToken The address of the fyToken contract.
     * @param liquidator The account who repays the borrower's debt and receives the collateral.
     * @param borrower The account who fell underwater and is liquidated.
     * @param collateralAmounts The amount of collaterals to clutch, specified in the collateral's decimal system and
     * presented in the same order as the collaterals array from the fyToken contract.
     * @return true = success, otherwise it reverts.
     */
    function clutchCollaterals(
        FyTokenInterface fyToken,
        address liquidator,
        address borrower,
        uint256[] memory collateralAmounts
    ) external override nonReentrant returns (bool) {
        /* Checks: the caller is the fyToken. */
        require(msg.sender == address(fyToken), "ERR_CLUTCH_COLLATERALS_NOT_AUTHORIZED");

        /* Grab the collaterals for the fyToken */
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        require(
            collaterals.length == collateralAmounts.length,
            "ERR_CLUTCH_COLLATERALS_AMOUNTS_ERROR"
        );

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            if (collateralAmounts[i] > 0) {
                /* Checks: there is enough clutchable collaterals in the vault. */
                uint256 lockedCollateral = vaults[address(fyToken)][borrower].lockedCollaterals[address(collaterals[i])];
                require(lockedCollateral >= collateralAmounts[i], "ERR_INSUFFICIENT_LOCKED_COLLATERALS");

                /* Calculate the new locked collateral amount. */
                MathError mathErr;
                uint256 newLockedCollateral;
                (mathErr, newLockedCollateral) = subUInt(lockedCollateral, collateralAmounts[i]);
                assert(mathErr == MathError.NO_ERROR);

                /* Effects: update the vault. */
                vaults[address(fyToken)][borrower].lockedCollaterals[address(collaterals[i])] = newLockedCollateral;

                /* Interactions: transfer the collateral. */
                collaterals[i].safeTransfer(liquidator, collateralAmounts[i]);
            }
        }

        emit ClutchCollaterals(fyToken, liquidator, borrower, collaterals, collateralAmounts);

        return true;
    }

    /**
     * @notice Deposits collaterals into the account's vault.
     *
     * @dev Emits a {DepositCollaterals} event.
     *
     * Requirements:
     *
     * - The vault must be open.
     * - The total amount to deposit cannot be zero.
     * - The Fintroller must allow this action to be performed.
     * - The caller must have allowed this contract to spend `collateralAmounts[...]` for each token.
     *
     * @param fyToken The address of the fyToken contract.
     * @param collateralAmounts The amount of collaterals to deposit.
     * @return true = success, otherwise it reverts.
     */
    function depositCollaterals(FyTokenInterface fyToken, uint256[] memory collateralAmounts)
        external
        override
        isVaultOpenForMsgSender(fyToken)
        nonReentrant
        returns (bool)
    {
        /* Checks: the zero edge case. */
        uint256 totalAmountToDeposit;
        MathError mathErr;

        for (uint256 i = 0; i < collateralAmounts.length; i += 1) {
            (mathErr, totalAmountToDeposit) = addUInt(
                totalAmountToDeposit,
                collateralAmounts[i]
            );
            require(mathErr == MathError.NO_ERROR, "ERR_DEPOSIT_COLLATERALS_MATH_ERROR");
        }

        require(totalAmountToDeposit > 0, "ERR_DEPOSIT_COLLATERALS_ZERO");

        /* Checks: the Fintroller allows this action to be performed. */
        require(fintroller.getDepositCollateralAllowed(fyToken), "ERR_DEPOSIT_COLLATERALS_NOT_ALLOWED");

        /* Grab the collaterals for the fyToken */
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        require(
            collaterals.length == collateralAmounts.length,
            "ERR_DEPOSIT_COLLATERALS_AMOUNTS_ERROR"
        );

        /* Effects: update storage. */
        for (uint256 i = 0; i < collaterals.length; i += 1) {
            if (collateralAmounts[i] > 0) {
                uint256 hypotheticalFreeCollateral;
                (mathErr, hypotheticalFreeCollateral) = addUInt(
                    vaults[address(fyToken)][msg.sender].freeCollaterals[address(collaterals[i])],
                    collateralAmounts[i]
                );
                require(mathErr == MathError.NO_ERROR, "ERR_DEPOSIT_COLLATERALS_MATH_ERROR");
                vaults[address(fyToken)][msg.sender].freeCollaterals[address(collaterals[i])] = hypotheticalFreeCollateral;

                /* Interactions: perform the Erc20 transfer. */
                collaterals[i].safeTransferFrom(msg.sender, address(this), collateralAmounts[i]);
            }
        }

        emit DepositCollaterals(fyToken, msg.sender, collaterals, collateralAmounts);

        return true;
    }

    struct FreeCollateralsLocalVars {
        MathError mathErr;
        uint256 collateralizationRatioMantissa;
        uint256 hypotheticalCollateralizationRatioMantissa;
        uint256[] newFreeCollaterals;
        uint256[] newLockedCollaterals;
        uint256 totalAmountToFree;
    }

    /**
     * @notice Frees a portion or all of the locked collaterals.
     * @dev Emits a {FreeCollaterals} event.
     *
     * Requirements:
     *
     * - The vault must be open.
     * - The total amount to free cannot be zero.
     * - There must be enough locked collaterals.
     * - The borrower account cannot fall below the collateralization ratio.
     *
     * @param fyToken The address of the fyToken contract.
     * @param collateralAmounts The amount of locked collaterals to free.
     * @return bool true = success, otherwise it reverts.
     */
    function freeCollaterals(
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    )
        external
        override
        isVaultOpenForMsgSender(fyToken)
        returns (bool)
    {
        FreeCollateralsLocalVars memory vars;

        /* Fetch the collaterals. */
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        /* Checks: the length of the amounts array. */
        require(collaterals.length == collateralAmounts.length, "ERR_FREE_COLLATERALS_AMOUNTS_ERROR");

        /* Checks: the zero edge case. */
        for (uint256 i = 0; i < collaterals.length; i += 1) {
            (vars.mathErr, vars.totalAmountToFree) = addUInt(
                vars.totalAmountToFree,
                collateralAmounts[i]
            );
        }
        require(vars.totalAmountToFree > 0, "ERR_FREE_COLLATERALS_ZERO");

        Vault storage vault = vaults[address(fyToken)][msg.sender];

        vars.newFreeCollaterals = new uint256[](collaterals.length);
        vars.newLockedCollaterals = new uint256[](collaterals.length);

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            if (collateralAmounts[i] > 0) {
                /* Checks: enough locked collateral. */
                require(vault.lockedCollaterals[address(collaterals[i])] >= collateralAmounts[i], "ERR_INSUFFICIENT_LOCKED_COLLATERALS");

                /* This operation can't fail because of the first `require` in this function. */
                (vars.mathErr, vars.newLockedCollaterals[i]) = subUInt(vault.lockedCollaterals[address(collaterals[i])], collateralAmounts[i]);
                assert(vars.mathErr == MathError.NO_ERROR);

                /* Effects: update storage. */
                vaults[address(fyToken)][msg.sender].lockedCollaterals[address(collaterals[i])] = vars.newLockedCollaterals[i];
                (vars.mathErr, vars.newFreeCollaterals[i]) = addUInt(vault.freeCollaterals[address(collaterals[i])], collateralAmounts[i]);
                require(vars.mathErr == MathError.NO_ERROR, "ERR_FREE_COLLATERALS_MATH_ERROR");
                vaults[address(fyToken)][msg.sender].freeCollaterals[address(collaterals[i])] = vars.newFreeCollaterals[i];
            }
        }

        /* Checks: the hypothetical collateralization ratio is above the threshold. */
        if (vault.debt > 0) {
            vars.hypotheticalCollateralizationRatioMantissa = getHypotheticalCollateralizationRatio(
                fyToken,
                msg.sender,
                vars.newLockedCollaterals,
                vault.debt
            );
            vars.collateralizationRatioMantissa = fintroller.getBondCollateralizationRatio(fyToken);
            require(
                vars.hypotheticalCollateralizationRatioMantissa >= vars.collateralizationRatioMantissa,
                "ERR_BELOW_COLLATERALIZATION_RATIO"
            );
        }

        emit FreeCollaterals(fyToken, msg.sender, collaterals, collateralAmounts);

        return true;
    }

    /**
     * @notice Locks a portion or all of the free collaterals to make them eligible for borrowing.
     * @dev Emits a {LockCollaterals} event.
     *
     * Requirements:
     *
     * - The vault must be open.
     * - The total amount to lock cannot be zero.
     * - There must be enough free collaterals.
     *
     * @param fyToken The address of the fyToken contract.
     * @param collateralAmounts The amounts of free collaterals to lock.
     * @return bool true = success, otherwise it reverts.
     */
    function lockCollaterals(
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    )
        external
        override
        isVaultOpenForMsgSender(fyToken)
        returns (bool)
    {
        /* Grab the collaterals for the fyToken */
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        require(
            collaterals.length == collateralAmounts.length,
            "ERR_LOCK_COLLATERAL_AMOUNTS_ERROR"
        );

        MathError mathErr;
        uint256 totalCollateralAmount;

        /* Avoid the zero edge case. */
        for (uint256 i = 0; i < collaterals.length; i += 1) {
            (mathErr, totalCollateralAmount) = addUInt(
                totalCollateralAmount,
                collateralAmounts[i]
            );

            require(mathErr == MathError.NO_ERROR, "ERR_LOCK_COLLATERALS_MATH_ERROR");
        }
        require(totalCollateralAmount > 0, "ERR_LOCK_COLLATERALS_ZERO");

        Vault storage vault = vaults[address(fyToken)][msg.sender];

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            if (collateralAmounts[i] > 0) {
                require(vault.freeCollaterals[address(collaterals[i])] >= collateralAmounts[i], "ERR_INSUFFICIENT_FREE_COLLATERALS");

                uint256 newLockedCollateral;
                (mathErr, newLockedCollateral) = addUInt(
                    vault.lockedCollaterals[address(collaterals[i])],
                    collateralAmounts[i]
                );
                require(mathErr == MathError.NO_ERROR, "ERR_LOCK_COLLATERALS_MATH_ERROR");
                vaults[address(fyToken)][msg.sender].lockedCollaterals[address(collaterals[i])] = newLockedCollateral;

                /* This operation can't fail because of the first `require` in this function. */
                uint256 hypotheticalFreeCollateral;
                (mathErr, hypotheticalFreeCollateral) = subUInt(vault.freeCollaterals[address(collaterals[i])], collateralAmounts[i]);
                assert(mathErr == MathError.NO_ERROR);
                vaults[address(fyToken)][msg.sender].freeCollaterals[address(collaterals[i])] = hypotheticalFreeCollateral;
            }
        }

        emit LockCollaterals(fyToken, msg.sender, collaterals, collateralAmounts);

        return true;
    }

    /**
     * @notice Opens a Vault for the caller.
     * @dev Emits an {OpenVault} event.
     *
     * Requirements:
     *
     * - The vault cannot be already open.
     * - The fyToken must pass the inspection.
     *
     * @param fyToken The address of the fyToken contract for which to open the vault.
     * @return true = success, otherwise it reverts.
     */
    function openVault(FyTokenInterface fyToken) external override returns (bool) {
        require(fyToken.isFyToken(), "ERR_OPEN_VAULT_FYTOKEN_INSPECTION");
        require(vaults[address(fyToken)][msg.sender].isOpen == false, "ERR_VAULT_OPEN");
        vaults[address(fyToken)][msg.sender].isOpen = true;
        emit OpenVault(fyToken, msg.sender);
        return true;
    }

    /**
     * @notice Updates the debt accrued by a particular borrower account.
     *
     * @dev Emits a {SetVaultDebt} event.
     *
     * Requirements:
     *
     * - Can only be called by the fyToken.
     *
     * @param fyToken The address of the fyToken contract.
     * @param borrower The borrower account for which to update the debt.
     * @param newVaultDebt The new debt to assign to the borrower account.
     * @return bool=true success, otherwise it reverts.
     */
    function setVaultDebt(
        FyTokenInterface fyToken,
        address borrower,
        uint256 newVaultDebt
    ) external override returns (bool) {
        /* Checks: the caller is the fyToken. */
        require(msg.sender == address(fyToken), "ERR_SET_VAULT_DEBT_NOT_AUTHORIZED");

        /* Effects: update storage. */
        uint256 oldVaultDebt = vaults[address(fyToken)][borrower].debt;
        vaults[address(fyToken)][borrower].debt = newVaultDebt;

        emit SetVaultDebt(fyToken, borrower, oldVaultDebt, newVaultDebt);

        return true;
    }

    /**
     * @notice Withdraws a portion or all of the free collaterals.
     *
     * @dev Emits a {WithdrawCollaterals} event.
     *
     * Requirements:
     *
     * - The vault must be open.
     * - The total amount to withdraw cannot be zero.
     * - There must be enough free collaterals in the vault.
     *
     * @param fyToken The address of the fyToken contract.
     * @param collateralAmounts The amounts to withdraw.
     * @return true = success, otherwise it reverts.
     */
    function withdrawCollaterals(
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    )
        external
        override
        isVaultOpenForMsgSender(fyToken)
        nonReentrant
        returns (bool)
    {
        /* Grab the collaterals for the fyToken */
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        require(
            collaterals.length == collateralAmounts.length,
            "ERR_WITHDRAW_COLLATERALS_AMOUNTS_ERROR"
        );

        MathError mathErr;
        uint256 totalCollateralAmounts;

        for (uint256 i = 0; i < collateralAmounts.length; i += 1) {
            (mathErr, totalCollateralAmounts) = addUInt(
                totalCollateralAmounts,
                collateralAmounts[i]
            );
            require(mathErr == MathError.NO_ERROR, "ERR_WITHDRAW_COLLATERALS_MATH_ERROR");
        }

        /* Avoid the zero edge case. */
        require(totalCollateralAmounts > 0, "ERR_WITHDRAW_COLLATERALS_ZERO");

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            if (collateralAmounts[i] > 0) {
                /* Checks: there is enough free collateral. */
                require(
                    vaults[address(fyToken)][msg.sender].freeCollaterals[address(collaterals[i])] >= collateralAmounts[i],
                    "ERR_INSUFFICIENT_FREE_COLLATERALS"
                );

                /* Effects: update storage. */
                uint256 newFreeCollateral;
                (mathErr, newFreeCollateral) = subUInt(
                    vaults[address(fyToken)][msg.sender].freeCollaterals[address(collaterals[i])],
                    collateralAmounts[i]
                );
                /* This operation can't fail because of the first `require` in this function. */
                assert(mathErr == MathError.NO_ERROR);
                vaults[address(fyToken)][msg.sender].freeCollaterals[address(collaterals[i])] = newFreeCollateral;

                /* Interactions: perform the Erc20 transfer. */
                collaterals[i].safeTransfer(msg.sender, collateralAmounts[i]);
            }
        }

        emit WithdrawCollaterals(fyToken, msg.sender, collaterals, collateralAmounts);

        return true;
    }
}
