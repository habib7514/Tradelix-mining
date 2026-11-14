
const { ethers } = require("ethers");
const artifact = require("../artifacts/contracts/TradelixMining.sol/TradelixMining.json");

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
    throw new Error("DEPLOYER_PRIVATE_KEY secret is missing");
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const network = await provider.getNetwork();
  if (network.chainId !== 56n) throw new Error("Wrong network");

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  if (wallet.address.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error("Wallet does not match treasury");
  }

  const token = new ethers.Contract(TOKEN, TOKEN_ABI, wallet);
  const balance = await token.balanceOf(wallet.address);
  if (balance < ALLOCATION) throw new Error("Insufficient TLX balance");

  if ((await provider.getCode(TOKEN)) === "0x" ||
      (await provider.getCode(SALE)) === "0x") {
    throw new Error("Token or Sale contract not found");
  }

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const nonce = await wallet.getNonce();
  const predictedAddress = ethers.getCreateAddress({
    from: wallet.address,
    nonce
  });

  const deployTx = await factory.getDeployTransaction(TOKEN, SALE);
  const deployGas = await provider.estimateGas({
    ...deployTx,
    from: wallet.address
  });

  const transferData = new ethers.Interface(TOKEN_ABI).encodeFunctionData(
    "transfer",
    [predictedAddress, ALLOCATION]
  );

  const transferGas = await provider.estimateGas({
    from: wallet.address,
    to: TOKEN,
    data: transferData
  });

  const fees = await provider.getFeeData();
  if (!fees.gasPrice) throw new Error("Cannot read BNB gas price");

  const estimated = (deployGas + transferGas) * fees.gasPrice;
  const required = estimated * 130n / 100n;
  const available = await provider.getBalance(wallet.address);

  console.log("Treasury:", wallet.address);
  console.log("TLX balance:", ethers.formatUnits(balance, 18));
  console.log("Predicted mining address:", predictedAddress);
  console.log("Daily rate: 1%");
  console.log("Allocation: 30,000,000 TLX");
  console.log("Estimated BNB with buffer:", ethers.formatEther(required));

  if (available < required) {
    throw new Error("Insufficient BNB. No transactions sent.");
  }

  console.log("Deploying mining contract...");
  const mining = await factory.deploy(TOKEN, SALE);
  await mining.waitForDeployment();

  const miningAddress = await mining.getAddress();
  if (miningAddress.toLowerCase() !== predictedAddress.toLowerCase()) {
    throw new Error("Address mismatch. Stop before funding.");
  }

  console.log("Mining deployed:", miningAddress);

  console.log("Funding mining contract with 30,000,000 TLX...");
  const transfer = await token.transfer(miningAddress, ALLOCATION);
  const receipt = await transfer.wait();

  if (!receipt || receipt.status !== 1) {
    throw new Error("TLX funding failed");
  }

  const check = new ethers.Contract(
    miningAddress,
    [
      "function DAILY_RATE() view returns (uint256)",
      "function RATE_DENOMINATOR() view returns (uint256)",
      "function miningReserveBalance() view returns (uint256)"
    ],
    provider
  );

  const [rate, denominator, reserve] = await Promise.all([
    check.DAILY_RATE(),
    check.RATE_DENOMINATOR(),
    check.miningReserveBalance()
  ]);

  console.log("DEPLOYMENT COMPLETE");
  console.log("Mining address:", miningAddress);
  console.log("Deployment TX:", mining.deploymentTransaction().hash);
  console.log("Funding TX:", transfer.hash);
  console.log("Rate:", rate.toString() + "/" + denominator.toString());
  console.log("Reserve:", ethers.formatUnits(reserve, 18), "TLX");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
