
const { ethers } = require("ethers");
const artifact = require("../artifacts/contracts/TradelixMining.sol/TradelixMining.json");

const RPC = "https://bsc-dataseed.binance.org/";
const TREASURY = "0x4E11E978119cAAB300b5439B909D06341C24a2A7";
const TOKEN = "0x252345178fb4E2b5724B96756c47Da89b618CD30";
const SALE = "0x95969e4888A0afC7bb54c30F020a353407B35e0F";
const ALLOCATION = ethers.parseUnits("30000000", 18);

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)"
];

async function main() {
  if (!process.env.PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY secret is missing");
  }

  const provider = new ethers.JsonRpcProvider(RPC);
  const network = await provider.getNetwork();

  if (network.chainId !== 56n) {
    throw new Error("Wrong network");
  }

  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  if (wallet.address.toLowerCase() !== TREASURY.toLowerCase()) {
    throw new Error("Wallet does not match treasury");
  }

  const token = new ethers.Contract(TOKEN, TOKEN_ABI, provider);
  const balance = await token.balanceOf(wallet.address);

  if (balance < ALLOCATION) {
    throw new Error("Insufficient TLX balance");
  }

  const saleCode = await provider.getCode(SALE);
  const tokenCode = await provider.getCode(TOKEN);

  if (saleCode === "0x" || tokenCode === "0x") {
    throw new Error("Token or Sale contract not found");
  }

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const deployTx = await factory.getDeployTransaction(TOKEN, SALE);

  const deployGas = await provider.estimateGas({
    ...deployTx,
    from: wallet.address
  });

  const fees = await provider.getFeeData();
  if (!fees.gasPrice) {
    throw new Error("Cannot read BNB gas price");
  }

  const transferInterface = new ethers.Interface([
    "function transfer(address,uint256) returns (bool)"
  ]);

  const transferData = transferInterface.encodeFunctionData(
    "transfer",
    [wallet.address, ALLOCATION]
  );

  const transferGas = await provider.estimateGas({
    from: wallet.address,
    to: TOKEN,
    data: transferData
  }).catch(() => 0n);

  if (transferGas === 0n) {
    throw new Error("Cannot estimate token transfer");
  }

  const totalGas = deployGas + transferGas;
  const estimatedCost = totalGas * fees.gasPrice;
  const withBuffer = estimatedCost * 120n / 100n;
  const available = await provider.getBalance(wallet.address);

  console.log("Wallet:", wallet.address);
  console.log("TLX balance:", ethers.formatUnits(balance, 18));
  console.log("Deployment gas:", deployGas.toString());
  console.log("TLX transfer gas:", transferGas.toString());
  console.log("Estimated BNB:", ethers.formatEther(estimatedCost));
  console.log("With 20% buffer:", ethers.formatEther(withBuffer));
  console.log("Available BNB:", ethers.formatEther(available));
  console.log("Daily rate: 1%");
  console.log("Mining allocation: 30,000,000 TLX");

  if (available < withBuffer) {
    throw new Error("Insufficient BNB. No transactions sent.");
  }

  console.log("ESTIMATE ONLY. No transactions sent.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
