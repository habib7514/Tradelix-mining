
require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {
      chainId: 56
    },
    bscMainnet: {
      url: "https://bsc-dataseed.binance.org/",
      chainId: 56
    }
  }
};
