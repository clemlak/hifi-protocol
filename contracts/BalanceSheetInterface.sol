/* SPDX-License-Identifier: LGPL-3.0-or-later */
pragma solidity ^0.7.0;

import "./BalanceSheetStorage.sol";
import "@paulrberg/contracts/token/erc20/Erc20Interface.sol";

/**
 * @title BalanceSheetInterface
 * @author Hifi
 */
abstract contract BalanceSheetInterface is BalanceSheetStorage {
    /**
     * CONSTANT FUNCTIONS
     */
    function getClutchableCollaterals(FyTokenInterface fyToken, uint256 repayAmount)
        external
        view
        virtual
        returns (
            uint256[] memory
        );

    function getCurrentCollateralizationRatio(FyTokenInterface fyToken, address borrower)
        public
        view
        virtual
        returns (uint256);

    function getHypotheticalCollateralizationRatio(
        FyTokenInterface fyToken,
        address borrower,
        uint256[] memory lockedCollateralAmounts,
        uint256 debt
    ) public view virtual returns (uint256);

    function getVault(FyTokenInterface fyToken, address borrower)
        external
        view
        virtual
        returns (
            uint256,
            uint256[] memory,
            uint256[] memory,
            bool
        );

    function getVaultDebt(FyTokenInterface fyToken, address borrower) external view virtual returns (uint256);

    function getVaultLockedCollaterals(FyTokenInterface fyToken, address borrower)
        external
        view
        virtual
        returns (
            uint256[] memory
        );

    function isAccountUnderwater(FyTokenInterface fyToken, address borrower) external view virtual returns (bool);

    function isVaultOpen(FyTokenInterface fyToken, address borrower) external view virtual returns (bool);

    /**
     * NON-CONSTANT FUNCTIONS
     */

    function clutchCollaterals(
        FyTokenInterface fyToken,
        address liquidator,
        address borrower,
        uint256[] memory collateralAmounts
    ) external virtual returns (bool);

    function depositCollaterals(
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) external virtual returns (bool);

    function freeCollaterals(
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) external virtual returns (bool);

    function lockCollaterals(
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) external virtual returns (bool);

    function openVault(FyTokenInterface fyToken) external virtual returns (bool);

    function setVaultDebt(
        FyTokenInterface fyToken,
        address borrower,
        uint256 newVaultDebt
    ) external virtual returns (bool);

    function withdrawCollaterals(
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) external virtual returns (bool);

    /**
     * EVENTS
     */

    event ClutchCollaterals(
        FyTokenInterface indexed fyToken,
        address indexed liquidator,
        address indexed borrower,
        Erc20Interface[] collateralAddresses,
        uint256[] collateralAmounts
    );

    event DepositCollaterals(
        FyTokenInterface indexed fyToken,
        address indexed borrower,
        Erc20Interface[] collateralAddresses,
        uint256[] collateralAmounts
    );

    event FreeCollaterals(
        FyTokenInterface indexed fyToken,
        address indexed borrower,
        Erc20Interface[] collateralAddresses,
        uint256[] collateralAmounts
    );

    event LockCollaterals(
        FyTokenInterface indexed fyToken,
        address indexed borrower,
        Erc20Interface[] collateralAddresses,
        uint256[] collateralAmounts
    );

    event OpenVault(FyTokenInterface indexed fyToken, address indexed borrower);

    event SetVaultDebt(FyTokenInterface indexed fyToken, address indexed borrower, uint256 oldDebt, uint256 newDebt);

    event WithdrawCollaterals(
        FyTokenInterface indexed fyToken,
        address indexed borrower,
        Erc20Interface[] collateralAddresses,
        uint256[] collateralAmounts
    );
}
