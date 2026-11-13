
const { ethers } = require("ethers");
const fs = require("fs");

const RPC = "https://bsc-dataseed.binance.org/";
const TREASURY = "0x4E11E978119cAAB300b5439B909D06341C24a2A7";
const USDT = "0x55d398326f99059fF775485246999027B3197955";

const INVENTORY = ethers.parseUnits("70000000", 18);

async function main() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY secret is missing");
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const network = await provider.getNetwork();

  if (network.chainId !== 56n) {
    throw new Error("Wrong network. BNB Smart Chain Mainnet required.");
  }

  const wallet = new ethers.Wallet(
    process.env.PRIVATE_KEY,
    provider
  );

  if (wallet.address.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error("Wallet does not match the approved treasury address.");
  }

  console.log("Network: BNB Smart Chain Mainnet");
  console.log("Treasury:", wallet.address);
  console.log("BNB balance:", ethers.formatEther(
    await provider.getBalance(wallet.address)
  ));

  function artifact(name) {
    return JSON.parse(
      fs.readFileSync(
        `artifacts/contracts/${name}.sol/${name}.json`,
        "utf8"
      )
    );
  }

  console.log("Deploying TradelixMining...");
  const miningFactory = new ethers.ContractFactory(
    artifact("TradelixMining").abi,
    artifact("TradelixMining").bytecode,
    wallet
  );
  const mining = await miningFactory.deploy();
  await mining.waitForDeployment();
  const miningAddress = await mining.getAddress();
  console.log("TradelixMining:", miningAddress);

  console.log("Deploying TradelixToken...");
  const tokenFactory = new ethers.ContractFactory(
    artifact("TradelixToken").abi,
    artifact("TradelixToken").bytecode,
    wallet
  );
  const token = await tokenFactory.deploy(miningAddress);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("TradelixToken:", tokenAddress);

  console.log("Deploying TradelixSale...");
  const saleFactory = new ethers.ContractFactory(
    artifact("TradelixSale").abi,
    artifact("TradelixSale").bytecode,
    wallet
  );
  const sale = await saleFactory.deploy(
    tokenAddress,
    TREASURY,
    USDT
  );
  await sale.waitForDeployment();
  const saleAddress = await sale.getAddress();
  console.log("TradelixSale:", saleAddress);

  console.log("Connecting mining contract to token...");
  await (await mining.setToken(tokenAddress)).wait();

  console.log("Connecting mining contract to sale...");
  await (await mining.setSale(saleAddress)).wait();

  console.log("Approving TLX inventory for sale...");
  await (
    await token.approve(saleAddress, INVENTORY)
  ).wait();

  console.log("Checking final balances...");
  console.log(
    "Treasury TLX:",
    ethers.formatUnits(await token.balanceOf(TREASURY), 18)
  );
  console.log(
    "Mining reserve:",
    ethers.formatUnits(await token.balanceOf(miningAddress), 18)
  );
  console.log(
    "Sale allowance:",
    ethers.formatUnits(
      await token.allowance(TREASURY, saleAddress),
      18
    )
  );

  console.log("DEPLOYMENT COMPLETED");
  console.log("Mining:", miningAddress);
  console.log("Token:", tokenAddress);
  console.log("Sale:", saleAddress);
}

main().catch((error) => {
  console.error("DEPLOYMENT FAILED:", error);
  process.exitCode = 1;
});
