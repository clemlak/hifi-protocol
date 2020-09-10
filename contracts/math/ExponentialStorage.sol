/* SPDX-License-Identifier: LPGL-3.0-or-later */
pragma solidity ^0.7.1;

/**
 * @title ExponentialStorage
 * @author Mainframe
 * @notice The storage interface ancillary to an Exponential contract.
 */
abstract contract ExponentialStorage {
    struct Exp {
        uint256 mantissa;
    }

    /**
     * @notice In Exponential denomination, 1e18 is 1.
     */
    uint256 public constant EXP_SCALE = 1e18;
    uint256 public constant HALF_EXP_SCALE = EXP_SCALE / 2;
    uint256 public constant MANTISSA_ONE = EXP_SCALE;
}
