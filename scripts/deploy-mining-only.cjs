
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

  const factory = new ethers.ContractFactory(
    artifact.abi, artifact.bytecode, wallet
  );

  const deployTx = await factory.getDeployTransaction();
  const deployGas = await provider.estimateGas({
    ...deployTx, from: wallet.address
  });

  const fees = await provider.getFeeData();
  const gasPrice = fees.gasPrice;
  if (!gasPrice) throw new Error("Cannot read BNB gas price");

  const predictedAddress = ethers.getCreateAddress({
    from: wallet.address,
    nonce: await wallet.getNonce("pending")
  });

  const miningInterface = new ethers.Interface(artifact.abi);
  const setTokenData = miningInterface.encodeFunctionData("setToken", [TOKEN]);
  const setSaleData = miningInterface.encodeFunctionData("setSale", [SALE]);

  const setTokenGas = await provider.estimateGas({
    from: wallet.address, to: predictedAddress, data: setTokenData
  }).catch(() => 0n);

  const setSaleGas = await provider.estimateGas({
    from: wallet.address, to: predictedAddress, data: setSaleData
  }).catch(() => 0n);

  const transferData = new ethers.Interface(TOKEN_ABI)
    .encodeFunctionData("transfer", [predictedAddress, ALLOCATION]);

  const transferGas = await provider.estimateGas({
    from: wallet.address, to: TOKEN, data: transferData
  });

  const totalGas = deployGas + setTokenGas + setSaleGas + transferGas;
  const estimatedCost = totalGas * gasPrice;
  const withBuffer = estimatedCost * 120n / 100n;

  console.log("Wallet:", wallet.address);
  console.log("TLX balance:", ethers.formatUnits(balance, 18));
  console.log("Predicted mining address:", predictedAddress);
  console.log("Deployment gas:", deployGas.toString());
  console.log("setToken gas:", setTokenGas.toString());
  console.log("setSale gas:", setSaleGas.toString());
  console.log("TLX transfer gas:", transferGas.toString());
  console.log("Estimated total BNB:", ethers.formatEther(estimatedCost));
  console.log("With 20% buffer:", ethers.formatEther(withBuffer));
  console.log("Available BNB:", ethers.formatEther(
    await provider.getBalance(wallet.address)
  ));

  if (setTokenGas === 0n || setSaleGas === 0n) {
    throw new Error("Cannot safely estimate setup transactions. No transactions sent.");
  }

  const available = await provider.getBalance(wallet.address);
  if (available < withBuffer) {
    throw new Error("Insufficient BNB for estimated total cost. No transactions sent.");
  }

  if (process.env.CONFIRM_MAINNET_DEPLOY !== "YES") {
    console.log("ESTIMATE ONLY. No transactions sent.");
    return;
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
