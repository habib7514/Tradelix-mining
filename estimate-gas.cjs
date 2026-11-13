
const fs = require("fs");
const { ethers } = require("ethers");

const RPC = "https://bsc-dataseed.binance.org/";

const WALLET = "0x4E11E978119cAAB300b5439B909D06341C24a2A7";
const USDT = "0x55d398326f99059fF775485246999027B3197955";

const DUMMY_ADDRESS = "0x0000000000000000000000000000000000000001";

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);

  const contracts = [
    {
      name: "TradelixMining",
      file: "artifacts/contracts/TradelixMining.sol/TradelixMining.json",
      args: []
    },
    {
      name: "TradelixToken",
      file: "artifacts/contracts/TradelixToken.sol/TradelixToken.json",
      args: [DUMMY_ADDRESS]
    },
    {
      name: "TradelixSale",
      file: "artifacts/contracts/TradelixSale.sol/TradelixSale.json",
      args: [DUMMY_ADDRESS, WALLET, USDT]
    }
  ];

  const feeData = await provider.getFeeData();
  const gasPrice = ethers.parseUnits("0.05", "gwei");

  console.log("BNB Smart Chain - Deployment Gas Estimate");
  console.log("Gas price: 0.05 Gwei");
  console.log("--------------------------------");

  let totalGas = 0n;

  for (const item of contracts) {
    const artifact = JSON.parse(fs.readFileSync(item.file, "utf8"));

    const factory = new ethers.ContractFactory(
      artifact.abi,
      artifact.bytecode
    );

    const tx = await factory.getDeployTransaction(...item.args);

    const gas = await provider.estimateGas({
      from: WALLET,
      data: tx.data
    });

    const cost = gas * gasPrice;
    totalGas += gas;

    console.log(item.name);
    console.log("Gas:", gas.toString());
    console.log(
      "Estimated cost (BNB):",
      ethers.formatEther(cost)
    );
    console.log(
      "Estimated cost (USD at $633/BNB):",
      (Number(ethers.formatEther(cost)) * 633).toFixed(6)
    );
    console.log("--------------------------------");
  }

  const totalCost = totalGas * gasPrice;

  console.log("TOTAL GAS:", totalGas.toString());
  console.log(
    "TOTAL BNB:",
    ethers.formatEther(totalCost)
  );
  console.log(
    "TOTAL USD at $633/BNB:",
    (Number(ethers.formatEther(totalCost)) * 633).toFixed(6)
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
