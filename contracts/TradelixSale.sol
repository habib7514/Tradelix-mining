// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TradelixSale is ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public constant USDT_ADDRESS =
        0x55d398326f99059fF775485246999027B3197955;

    address public constant TREASURY_WALLET =
        0x4E11E978119cAAB300b5439B909D06341C24a2A7;

    IERC20 public immutable tlxToken;
    address public immutable inventoryWallet;

    uint256 public constant MIN_PURCHASE = 5 ether;

    mapping(address => bool) public hasPurchased;
    mapping(address => uint256) public firstPurchaseTokens;

    event TokensPurchased(
        address indexed buyer,
        uint256 usdtAmount,
        uint256 tlxAmount,
        bool firstPurchase
    );

    constructor(address tokenAddress, address inventoryAddress) {
        require(tokenAddress != address(0), "Invalid TLX address");
        require(inventoryAddress != address(0), "Invalid inventory");

        require(
            IERC20Metadata(USDT_ADDRESS).decimals() == 18,
            "Unexpected USDT decimals"
        );

        tlxToken = IERC20(tokenAddress);
        inventoryWallet = inventoryAddress;
    }

    function buy(uint256 usdtAmount) external nonReentrant {
        require(usdtAmount >= MIN_PURCHASE, "Minimum is 5 USDT");

        uint256 tlxAmount = usdtAmount * 10;

        IERC20(USDT_ADDRESS).safeTransferFrom(
            msg.sender,
            TREASURY_WALLET,
            usdtAmount
        );

        tlxToken.safeTransferFrom(
            inventoryWallet,
            msg.sender,
            tlxAmount
        );

        bool first = !hasPurchased[msg.sender];

        if (first) {
            hasPurchased[msg.sender] = true;
            firstPurchaseTokens[msg.sender] = tlxAmount;
        }

        emit TokensPurchased(
            msg.sender,
            usdtAmount,
            tlxAmount,
            first
        );
    }
}