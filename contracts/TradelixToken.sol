
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TradelixToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 100_000_000 * 10**18;
    uint256 public constant MINING_RESERVE = 30_000_000 * 10**18;

    constructor(address miningWallet)
        ERC20("Tradelix", "TLX")
        Ownable(msg.sender)
    {
        require(miningWallet != address(0), "Invalid mining wallet");

        _mint(msg.sender, TOTAL_SUPPLY - MINING_RESERVE);
        _mint(miningWallet, MINING_RESERVE);
    }
}
