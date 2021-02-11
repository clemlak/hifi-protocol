/* SPDX-License-Identifier: LGPL-3.0-or-later */
pragma solidity ^0.7.0;

import "../BalanceSheet.sol";
import "../FyTokenInterface.sol";

/**
 * @title GodModeBalanceSheet
 * @author Hifi
 * @dev Strictly for test purposes. Do not use in production.
 */
contract GodModeBalanceSheet is BalanceSheet {
    /* solhint-disable-next-line no-empty-blocks */
    constructor(FintrollerInterface fintroller_) BalanceSheet(fintroller_) {}

    function __godMode_setVaultDebt(
        FyTokenInterface fyToken,
        address borrower,
        uint256 newVaultDebt
    ) external {
        vaults[address(fyToken)][borrower].debt = newVaultDebt;
    }

    function __godMode_setVaultFreeCollaterals(
        FyTokenInterface fyToken,
        address borrower,
        uint256[] memory newFreeCollaterals
    ) external {
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            vaults[address(fyToken)][borrower].freeCollaterals[address(collaterals[i])] = newFreeCollaterals[i];
        }
    }

    function __godMode_setVaultLockedCollaterals(
        FyTokenInterface fyToken,
        address borrower,
        uint256[] memory newLockedCollaterals
    ) external {
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            vaults[address(fyToken)][borrower].lockedCollaterals[address(collaterals[i])] = newLockedCollaterals[i];
        }
    }

    function __godMode_setVaultIsOpen(
        FyTokenInterface fyToken,
        address borrower,
        bool newIsOpen
    ) external {
        vaults[address(fyToken)][borrower].isOpen = newIsOpen;
    }
}
