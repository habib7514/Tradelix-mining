const { ethers } = require("ethers");

const RPC = "https://bsc-dataseed.binance.org/";
const TREASURY = "0x4E11E978119cAAB300b5439B909D06341C24a2A7";
const TOKEN = "0x252345178fb4E2b5724B96756c47Da89b618CD30";
const SALE = "0x95969e4888A0afC7bb54c30F020a353407B35e0F";
const ALLOCATION = ethers.parseUnits("30000000", 18);

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)"
];

async function main() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY secret is missing");
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const network = await provider.getNetwork();

  if (network.chainId !== 56n) {
    throw new Error("Wrong network");
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  if (wallet.address.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error("Wrong treasury wallet");
  }

  const token = new ethers.Contract(TOKEN, TOKEN_ABI, wallet);
  const balance = await token.balanceOf(wallet.address);

  if (balance < ALLOCATION) {
    throw new Error("Insufficient TLX balance");
  }

  const artifact = require("../artifacts/contracts/TradelixMining.sol/TradelixMining.json");
  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const request = await factory.getDeployTransaction();
  const gas = await provider.estimateGas({
    ...request,
    from: wallet.address
  });

  const fees = await provider.getFeeData();
  const gasPrice = fees.maxFeePerGas ?? fees.gasPrice;

  if (!gasPrice) throw new Error("Cannot read gas price");

  console.log("Deployment gas:", gas.toString());
  console.log("Estimated BNB:", ethers.formatEther(gas * gasPrice));
  console.log("No transaction sent yet.");

  if (process.env.CONFIRM_MAINNET_DEPLOY !== "YES") {
    throw new Error("Deployment not authorized");
  }

  const mining = await factory.deploy();
  await mining.waitForDeployment();

  const address = await mining.getAddress();
  console.log("New mining contract:", address);

  await (await mining.setToken(TOKEN)).wait();
  await (await mining.setSale(SALE)).wait();
  await (await token.transfer(address, ALLOCATION)).wait();

  console.log("Daily rate:", Number(await mining.DAILY_RATE()) / 100, "%");
  console.log("Reserve:", ethers.formatUnits(
    await token.balanceOf(address), 18
  ), "TLX");
  console.log("SUCCESS:", address);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
