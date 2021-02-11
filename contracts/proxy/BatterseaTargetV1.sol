/* SPDX-License-Identifier: LGPL-3.0-or-later */
pragma solidity ^0.7.0;

import "@paulrberg/contracts/math/CarefulMath.sol";
import "@paulrberg/contracts/token/erc20/Erc20Interface.sol";
import "@paulrberg/contracts/token/erc20/SafeErc20.sol";

import "./BatterseaTargetV1Interface.sol";
import "../BalanceSheetInterface.sol";
import "../FyTokenInterface.sol";
import "../RedemptionPoolInterface.sol";
import "../external/balancer/ExchangeProxyInterface.sol";
import "../external/balancer/TokenInterface.sol";
import "../external/weth/WethInterface.sol";

/**
 * @title BatterseaTargetV1
 * @author Hifi
 * @notice Target contract with scripts for the Battersea release of the protocol.
 * @dev Meant to be used with a DSProxy contract via delegatecall.
 */
contract BatterseaTargetV1 is
    CarefulMath, /* no dependency */
    BatterseaTargetV1Interface /* one dependency */
{
    using SafeErc20 for Erc20Interface;
    using SafeErc20 for FyTokenInterface;

    /**
     * @notice Borrows fyTokens.
     *
     * @param fyToken The address of the FyToken contract.
     * @param borrowAmount The amount of fyTokens to borrow.
     */
    function borrow(FyTokenInterface fyToken, uint256 borrowAmount) public {
        fyToken.borrow(borrowAmount);
        fyToken.safeTransfer(msg.sender, borrowAmount);
    }

    /**
     * @notice Borrows fyTokens and sells them on Balancer in exchange for underlying.
     *
     * @dev Emits a {BorrowAndSellFyTokens} event.
     *
     * This is a payable function so it can receive ETH transfers.
     *
     * @param fyToken The address of the FyToken contract.
     * @param borrowAmount The amount of fyTokens to borrow.
     * @param underlyingAmount The amount of underlying to sell fyTokens for.
     */
    function borrowAndSellFyTokens(
        FyTokenInterface fyToken,
        uint256 borrowAmount,
        uint256 underlyingAmount
    ) public payable {
        Erc20Interface underlying = fyToken.underlying();

        /* Borrow the fyTokens. */
        fyToken.borrow(borrowAmount);

        /* Allow the Balancer contract to spend fyTokens if allowance not enough. */
        uint256 allowance = fyToken.allowance(address(this), EXCHANGE_PROXY_ADDRESS);
        if (allowance < borrowAmount) {
            fyToken.approve(EXCHANGE_PROXY_ADDRESS, uint256(-1));
        }

        /* Prepare the parameters for calling Balancer. */
        TokenInterface tokenIn = TokenInterface(address(fyToken));
        TokenInterface tokenOut = TokenInterface(address(underlying));
        uint256 totalAmountOut = underlyingAmount;
        uint256 maxTotalAmountIn = borrowAmount;
        uint256 nPools = 1;

        /* Recall that Balancer reverts when the swap is not successful. */
        uint256 totalAmountIn =
            ExchangeProxyInterface(EXCHANGE_PROXY_ADDRESS).smartSwapExactOut(
                tokenIn,
                tokenOut,
                totalAmountOut,
                maxTotalAmountIn,
                nPools
            );

        /* When we get a better price than the worst that we assumed we would, not all fyTokens are sold. */
        MathError mathErr;
        uint256 fyTokenDelta;
        (mathErr, fyTokenDelta) = subUInt(borrowAmount, totalAmountIn);
        require(mathErr == MathError.NO_ERROR, "ERR_BORROW_AND_SELL_FYTOKENS_MATH_ERROR");

        /* If the fyToken delta is non-zero, we use it to partially repay the borrow. */
        /* Note: this is not gas-efficient. */
        if (fyTokenDelta > 0) {
            fyToken.repayBorrow(fyTokenDelta);
        }

        /* Finally, transfer the recently bought underlying to the end user. */
        underlying.safeTransfer(msg.sender, underlyingAmount);

        emit BorrowAndSellFyTokens(msg.sender, borrowAmount, fyTokenDelta, underlyingAmount);
    }

    /**
     * @notice Deposits collaterals into the BalanceSheet contract.
     *
     * @dev Requirements:
     * - The caller must have allowed the DSProxy to spend `collateralAmounts[...]` tokens.
     *
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param collateralAmounts The amounts of collateral to deposit.
     */
    function depositCollaterals(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) public {
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            /* Transfer the collateral to the DSProxy if the amount is > 0. */
            if (collateralAmounts[i] > 0) {
                collaterals[i].safeTransferFrom(msg.sender, address(this), collateralAmounts[i]);
            }
        }

        /* Deposit the collateral into the BalanceSheet contract. */
        depositCollateralsInternal(balanceSheet, fyToken, collateralAmounts);
    }

    /**
     * @notice Deposits and locks collaterals into the BalanceSheet contract.
     *
     * @dev Requirements:
     * - The caller must have allowed the DSProxy to spend `collateralAmounts[...]` tokens.
     *
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param collateralAmounts The amounts of collateral to deposit and lock.
     */
    function depositAndLockCollaterals(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) public {
        depositCollaterals(balanceSheet, fyToken, collateralAmounts);
        balanceSheet.lockCollaterals(fyToken, collateralAmounts);
    }

    /**
     * @notice Deposits and locks collaterals into the vault via the BalanceSheet contract
     * and borrows fyTokens.
     *
     * @dev This is a payable function so it can receive ETH transfers.
     *
     * Requirements:
     * - The caller must have allowed the DSProxy to spend `collateralAmount` tokens.
     *
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param collateralAmounts The amounts of collateral to deposit and lock.
     * @param borrowAmount The amount of fyTokens to borrow.
     */
    function depositAndLockCollateralsAndBorrow(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts,
        uint256 borrowAmount
    ) public payable {
        depositAndLockCollaterals(balanceSheet, fyToken, collateralAmounts);
        borrow(fyToken, borrowAmount);
    }

    /**
     * @notice Deposits and locks collaterals into the vault via the BalanceSheet contract, borrows fyTokens
     * and sells them on Balancer in exchange for underlying.
     *
     * @dev This is a payable function so it can receive ETH transfers.
     *
     * Requirements:
     * - The caller must have allowed the DSProxy to spend `collateralAmounts[...]` tokens.
     *
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param collateralAmounts The amounts of collateral to deposit and lock.
     * @param borrowAmount The amount of fyTokens to borrow.
     * @param underlyingAmount The amount of underlying to sell fyTokens for.
     */
    function depositAndLockCollateralsAndBorrowAndSellFyTokens(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts,
        uint256 borrowAmount,
        uint256 underlyingAmount
    ) external payable {
        depositAndLockCollaterals(balanceSheet, fyToken, collateralAmounts);
        borrowAndSellFyTokens(fyToken, borrowAmount, underlyingAmount);
    }

    /**
     * @notice Frees collaterals from the vault in the BalanceSheet contract.
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param collateralAmounts The amounts of collateral to free.
     */
    function freeCollaterals(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) external {
        balanceSheet.freeCollaterals(fyToken, collateralAmounts);
    }

    /**
     * @notice Frees collateral from the vault and withdraws it from the
     * BalanceSheet contract.
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param collateralAmounts The amounts of collateral to free and withdraw.
     */
    function freeAndWithdrawCollaterals(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) external {
        balanceSheet.freeCollaterals(fyToken, collateralAmounts);
        withdrawCollaterals(balanceSheet, fyToken, collateralAmounts);
    }

    /**
     * @notice Locks collaterals in the vault in the BalanceSheet contract.
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param collateralAmounts The amounts of collateral to lock.
     */
    function lockCollateral(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
    uint256[] memory collateralAmounts
    ) external {
        balanceSheet.lockCollaterals(fyToken, collateralAmounts);
    }

    /**
     * @notice Locks collaterals into the vault in the BalanceSheet contract
     * and draws debt via the FyToken contract.
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param collateralAmounts The amounts of collateral to lock.
     * @param borrowAmount The amount of fyTokens to borrow.
     * @param underlyingAmount The amount of underlying to sell fyTokens for.
     */
    function lockCollateralsAndBorrow(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts,
        uint256 borrowAmount,
        uint256 underlyingAmount
    ) external {
        balanceSheet.lockCollaterals(fyToken, collateralAmounts);
        borrowAndSellFyTokens(fyToken, borrowAmount, underlyingAmount);
    }

    /**
     * @notice Open the vaults in the BalanceSheet contract for the given fyToken.
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     */
    function openVault(BalanceSheetInterface balanceSheet, FyTokenInterface fyToken) external {
        balanceSheet.openVault(fyToken);
    }

    /**
     * @notice Redeems fyTokens in exchange for underlying tokens.
     *
     * @dev Requirements:
     * - The caller must have allowed the DSProxy to spend `repayAmount` fyTokens.
     *
     * @param fyToken The address of the FyToken contract.
     * @param fyTokenAmount The amount of fyTokens to redeem.
     */
    function redeemFyTokens(FyTokenInterface fyToken, uint256 fyTokenAmount) public {
        Erc20Interface underlying = fyToken.underlying();
        RedemptionPoolInterface redemptionPool = fyToken.redemptionPool();

        /* Transfer the fyTokens to the DSProxy. */
        fyToken.safeTransferFrom(msg.sender, address(this), fyTokenAmount);

        /* Redeem the fyTokens. */
        uint256 preUnderlyingBalance = underlying.balanceOf(address(this));
        redemptionPool.redeemFyTokens(fyTokenAmount);

        /* Calculate how many underlying have been redeemed. */
        uint256 postUnderlyigBalance = underlying.balanceOf(address(this));
        MathError mathErr;
        uint256 underlyingAmount;
        (mathErr, underlyingAmount) = subUInt(postUnderlyigBalance, preUnderlyingBalance);
        require(mathErr == MathError.NO_ERROR, "ERR_REDEEM_FYTOKENS_MATH_ERROR");

        /* The underlying is now in the DSProxy, so we relay it to the end user. */
        underlying.safeTransfer(msg.sender, underlyingAmount);
    }

    /**
     * @notice Repays the fyToken borrow.
     *
     * @dev Requirements:
     * - The caller must have allowed the DSProxy to spend `repayAmount` fyTokens.
     *
     * @param fyToken The address of the FyToken contract.
     * @param repayAmount The amount of fyTokens to repay.
     */
    function repayBorrow(FyTokenInterface fyToken, uint256 repayAmount) public {
        /* Transfer the fyTokens to the DSProxy. */
        fyToken.safeTransferFrom(msg.sender, address(this), repayAmount);

        /* Repay the borrow. */
        fyToken.repayBorrow(repayAmount);
    }

    /**
     * @notice Market sells underlying and repays the borrows via the FyToken contract.
     *
     * @dev Requirements:
     * - The caller must have allowed the DSProxy to spend `underlyingAmount` tokens.
     *
     * @param fyToken The address of the FyToken contract.
     * @param underlyingAmount The amount of underlying to sell.
     * @param repayAmount The amount of fyTokens to repay.
     */
    function sellUnderlyingAndRepayBorrow(
        FyTokenInterface fyToken,
        uint256 underlyingAmount,
        uint256 repayAmount
    ) external {
        Erc20Interface underlying = fyToken.underlying();

        /* Transfer the underlying to the DSProxy. */
        underlying.safeTransferFrom(msg.sender, address(this), underlyingAmount);

        /* Allow the Balancer contract to spend underlying if allowance not enough. */
        uint256 allowance = underlying.allowance(address(this), EXCHANGE_PROXY_ADDRESS);
        if (allowance < underlyingAmount) {
            underlying.approve(EXCHANGE_PROXY_ADDRESS, uint256(-1));
        }

        /* Prepare the parameters for calling Balancer. */
        TokenInterface tokenIn = TokenInterface(address(underlying));
        TokenInterface tokenOut = TokenInterface(address(fyToken));
        uint256 totalAmountOut = repayAmount;
        uint256 maxTotalAmountIn = underlyingAmount;
        uint256 nPools = 1;

        /* Recall that Balancer reverts when the swap is not successful. */
        uint256 totalAmountIn =
            ExchangeProxyInterface(EXCHANGE_PROXY_ADDRESS).smartSwapExactOut(
                tokenIn,
                tokenOut,
                totalAmountOut,
                maxTotalAmountIn,
                nPools
            );

        /* Use the recently bought fyTokens to repay the borrow. */
        fyToken.repayBorrow(repayAmount);

        /* When we get a better price than the worst that we assumed we would, not all underlying is sold. */
        MathError mathErr;
        uint256 underlyingDelta;
        (mathErr, underlyingDelta) = subUInt(underlyingAmount, totalAmountIn);
        require(mathErr == MathError.NO_ERROR, "ERR_SELL_UNDERLYING_AND_REPAY_BORROW_MATH_ERROR");

        /* If the underlying delta is non-zero, send it back to the user. */
        if (underlyingDelta > 0) {
            underlying.safeTransfer(msg.sender, underlyingDelta);
        }
    }

    /**
     * @notice Supplies the underlying to the RedemptionPool contract and mints fyTokens.
     * @param fyToken The address of the FyToken contract.
     * @param underlyingAmount The amount of underlying to supply.
     */
    function supplyUnderlying(FyTokenInterface fyToken, uint256 underlyingAmount) public {
        uint256 preFyTokenBalance = fyToken.balanceOf(address(this));
        supplyUnderlyingInternal(fyToken, underlyingAmount);

        /* Calculate how many fyTokens have been minted. */
        uint256 postFyTokenBalance = fyToken.balanceOf(address(this));
        MathError mathErr;
        uint256 fyTokenAmount;
        (mathErr, fyTokenAmount) = subUInt(postFyTokenBalance, preFyTokenBalance);
        require(mathErr == MathError.NO_ERROR, "ERR_SUPPLY_UNDERLYING_MATH_ERROR");

        /* The fyTokens are now in the DSProxy, so we relay them to the end user. */
        fyToken.safeTransfer(msg.sender, fyTokenAmount);
    }

    /**
     * @notice Supplies the underlying to the RedemptionPool contract, mints fyTokens
     * and repays the borrow.
     *
     * @dev Requirements:
     * - The caller must have allowed the DSProxy to spend `underlyingAmount` tokens.
     *
     * @param fyToken The address of the FyToken contract.
     * @param underlyingAmount The amount of underlying to supply.
     */
    function supplyUnderlyingAndRepayBorrow(FyTokenInterface fyToken, uint256 underlyingAmount) external {
        uint256 preFyTokenBalance = fyToken.balanceOf(address(this));
        supplyUnderlyingInternal(fyToken, underlyingAmount);

        /* Calculate how many fyTokens have been minted. */
        uint256 postFyTokenBalance = fyToken.balanceOf(address(this));
        MathError mathErr;
        uint256 fyTokenAmount;
        (mathErr, fyTokenAmount) = subUInt(postFyTokenBalance, preFyTokenBalance);
        require(mathErr == MathError.NO_ERROR, "ERR_SUPPLY_UNDERLYING_AND_REPAY_BORROW_MATH_ERROR");

        /* Use the newly minted fyTokens to repay the debt. */
        fyToken.repayBorrow(fyTokenAmount);
    }

    /**
     * @notice Withdraws collateral from the vault in the BalanceSheet contract.
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param collateralAmounts The amounts of collateral to withdraw.
     */
    function withdrawCollaterals(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) public {
        balanceSheet.withdrawCollaterals(fyToken, collateralAmounts);

        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        /* The collaterals are now in the DSProxy, so we relay them to the end user. */
        for (uint256 i = 0; i < collaterals.length; i += 1) {
            collaterals[i].safeTransfer(msg.sender, collateralAmounts[i]);
        }
    }

    /**
     * @notice Wraps ETH into WETH and deposits into the BalanceSheet contract.
     *
     * @dev This is a payable function so it can receive ETH transfers.
     *
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     */
    function wrapEthAndDepositCollaterals(BalanceSheetInterface balanceSheet, FyTokenInterface fyToken) public payable {
        uint256[] memory collateralAmounts = new uint256[](1);
        collateralAmounts[0] = msg.value;

        /* Convert the received ETH to WETH. */
        WethInterface(WETH_ADDRESS).deposit{ value: collateralAmounts[0] }();

        /* Deposit the collaterals into the BalanceSheet contract. */
        depositCollateralsInternal(balanceSheet, fyToken, collateralAmounts);
    }

    /**
     * @notice Wraps ETH into WETH, deposits and locks collaterals into the BalanceSheet contract
     * and borrows fyTokens.
     *
     * @dev This is a payable function so it can receive ETH transfers.
     *
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     */
    function wrapEthAndDepositAndLockCollaterals(BalanceSheetInterface balanceSheet, FyTokenInterface fyToken)
        public
        payable
    {
        uint256[] memory collateralAmounts = new uint256[](1);
        collateralAmounts[0] = msg.value;
        wrapEthAndDepositCollaterals(balanceSheet, fyToken);
        balanceSheet.lockCollaterals(fyToken, collateralAmounts);
    }

    /**
     * @notice Wraps ETH into WETH, deposits and locks collaterals into the vault in the BalanceSheet
     * contracts and borrows fyTokens.
     *
     * @dev This is a payable function so it can receive ETH transfers.
     *
     * @param balanceSheet The address of the BalanceSheet contract.
     * @param fyToken The address of the FyToken contract.
     * @param borrowAmount The amount of fyTokens to borrow.
     * @param underlyingAmount The amount of underlying to sell fyTokens for.
     */
    function wrapEthAndDepositAndLockCollateralAndBorrow(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256 borrowAmount,
        uint256 underlyingAmount
    ) external payable {
        wrapEthAndDepositAndLockCollaterals(balanceSheet, fyToken);
        borrowAndSellFyTokens(fyToken, borrowAmount, underlyingAmount);
    }

    /**
     * INTERNAL FUNCTIONS
     */

    /**
     * @dev See the documentation for the public functions that call this internal function.
     */
    function depositCollateralsInternal(
        BalanceSheetInterface balanceSheet,
        FyTokenInterface fyToken,
        uint256[] memory collateralAmounts
    ) internal {
        /* Allow the BalanceSheet contract to spend tokens if allowance not enough. */
        Erc20Interface[] memory collaterals = fyToken.getCollaterals();

        for (uint256 i = 0; i < collaterals.length; i += 1) {
            uint256 allowance = collaterals[i].allowance(address(this), address(balanceSheet));
            if (allowance < collateralAmounts[i]) {
                collaterals[i].approve(address(balanceSheet), uint256(-1));
            }
        }

        /* Open the vault if not already open. */
        bool isVaultOpen = balanceSheet.isVaultOpen(fyToken, address(this));
        if (isVaultOpen == false) {
            balanceSheet.openVault(fyToken);
        }

        /* Deposit the collaterals into the BalanceSheet contract. */
        balanceSheet.depositCollaterals(fyToken, collateralAmounts);
    }

    /**
     * @dev See the documentation for the public functions that call this internal function.
     */
    function supplyUnderlyingInternal(FyTokenInterface fyToken, uint256 underlyingAmount) internal {
        RedemptionPoolInterface redemptionPool = fyToken.redemptionPool();
        Erc20Interface underlying = fyToken.underlying();

        /* Transfer the underlying to the DSProxy. */
        underlying.safeTransferFrom(msg.sender, address(this), underlyingAmount);

        /* Allow the RedemptionPool contract to spend tokens if allowance not enough. */
        uint256 allowance = underlying.allowance(address(this), address(redemptionPool));
        if (allowance < underlyingAmount) {
            underlying.approve(address(redemptionPool), uint256(-1));
        }

        /* Supply the underlying and mint fyTokens. */
        redemptionPool.supplyUnderlying(underlyingAmount);
    }
}
