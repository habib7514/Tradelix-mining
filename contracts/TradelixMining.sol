
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

interface ITradelixSaleData {
    function firstPurchaseTokens(address user) external view returns (uint256);
    function firstPurchaseTime(address user) external view returns (uint256);
}

contract TradelixMining is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable tlxToken;
    ITradelixSaleData public immutable saleContract;

    mapping(address => uint256) public lastClaimTime;

    uint256 public constant DAILY_RATE = 100;
    uint256 public constant RATE_DENOMINATOR = 10000;
    uint256 public constant DAY = 1 days;
    uint256 public constant MAX_REWARDS = 30_000_000 * 10**18;

    uint256 public totalRewardsPaid;

    event MiningClaimed(address indexed user, uint256 amount, uint256 timestamp);

    constructor(address tokenAddress, address saleAddress) Ownable(msg.sender) {
        require(tokenAddress != address(0), "Invalid token");
        require(saleAddress != address(0), "Invalid sale");
        tlxToken = IERC20(tokenAddress);
        saleContract = ITradelixSaleData(saleAddress);
    }

    function claim() external nonReentrant {
        uint256 baseAmount = saleContract.firstPurchaseTokens(msg.sender);
        uint256 purchaseTime = saleContract.firstPurchaseTime(msg.sender);

        require(baseAmount > 0, "No eligible first purchase");
        require(purchaseTime > 0, "Purchase not recorded");

        uint256 previousClaim = lastClaimTime[msg.sender];
        if (previousClaim == 0) previousClaim = purchaseTime;

        require(block.timestamp >= previousClaim + DAY, "Wait 24 hours");

        uint256 elapsed = block.timestamp - previousClaim;
        uint256 reward = Math.mulDiv(
            baseAmount,
            DAILY_RATE * elapsed,
            RATE_DENOMINATOR * DAY
        );

        require(reward > 0, "Reward too small");
        require(totalRewardsPaid + reward <= MAX_REWARDS, "Mining allocation exhausted");
        require(tlxToken.balanceOf(address(this)) >= reward, "Mining reserve insufficient");

        lastClaimTime[msg.sender] = block.timestamp;
        totalRewardsPaid += reward;
        tlxToken.safeTransfer(msg.sender, reward);

        emit MiningClaimed(msg.sender, reward, block.timestamp);
    }

    function miningReserveBalance() external view returns (uint256) {
        return tlxToken.balanceOf(address(this));
    }

    function remainingRewards() external view returns (uint256) {
        return MAX_REWARDS - totalRewardsPaid;
    }
}
