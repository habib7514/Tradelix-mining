
const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Tradelix AI - Smart Contract Tests", function () {
  let owner, buyer, mining, token, sale, mockUSDT;

  const parse = ethers.parseEther;
  const TREASURY = "0x4E11E978119cAAB300b5439B909D06341C24a2A7;

  beforeEach(async function () {
    [owner, buyer] = await ethers.getSigners();

    const MockUSDT = await ethers.getContractFactory("MockUSDT");
    mockUSDT = await MockUSDT.deploy();
    await mockUSDT.waitForDeployment();

    const nonce = await owner.getNonce();
    const predictedMiningAddress = ethers.getCreateAddress({
      from: owner.address,
      nonce: nonce + 3
    });

    const Token = await ethers.getContractFactory("TradelixToken");
    token = await Token.deploy(predictedMiningAddress);
    await token.waitForDeployment();

    const Sale = await ethers.getContractFactory("TradelixSale");
    sale = await Sale.deploy(
      await token.getAddress(),
      owner.address,
      await mockUSDT.getAddress()
    );
    await sale.waitForDeployment();

    const Mining = await ethers.getContractFactory("TradelixMining");
    mining = await Mining.deploy(
      await token.getAddress(),
      await sale.getAddress()
    );
    await mining.waitForDeployment();

    expect((await mining.getAddress()).toLowerCase())
      .to.equal(predictedMiningAddress.toLowerCase());

    await token.approve(await sale.getAddress(), parse("70000000"));

    await mockUSDT.mint(buyer.address, parse("100"));
    await mockUSDT.connect(buyer).approve(
      await sale.getAddress(),
      parse("100")
    );
  });

  it("should create the correct total token supply", async function () {
    expect(await token.totalSupply()).to.equal(parse("100000000"));
  });

  it("should allocate 30 million TLX to mining", async function () {
    expect(await token.balanceOf(await mining.getAddress()))
      .to.equal(parse("30000000"));
  });

  it("should reject purchases below 5 USDT", async function () {
    await expect(
      sale.connect(buyer).buy(parse("4"))
    ).to.be.revertedWith("Minimum is 5 USDT");
  });

  it("should record only the first purchase for mining", async function () {
    await sale.connect(buyer).buy(parse("5"));

    expect(await sale.firstPurchaseTokens(buyer.address))
      .to.equal(parse("50"));
    expect(await sale.firstPurchaseTime(buyer.address))
      .to.be.greaterThan(0);

    await sale.connect(buyer).buy(parse("10"));

    expect(await sale.firstPurchaseTokens(buyer.address))
      .to.equal(parse("50"));
    expect(await token.balanceOf(buyer.address))
      .to.equal(parse("150"));
  });

  it("should send purchase payments directly to the treasury", async function () {
    await sale.connect(buyer).buy(parse("5"));
    expect(await mockUSDT.balanceOf(TREASURY)).to.equal(parse("5"));
  });

  it("should not allow mining before 24 hours", async function () {
    await sale.connect(buyer).buy(parse("5"));

    await expect(
      mining.connect(buyer).claim()
    ).to.be.revertedWith("Wait 24 hours");
  });

  it("should pay exactly 1 percent daily on the first purchase only", async function () {
    await sale.connect(buyer).buy(parse("5"));
    await sale.connect(buyer).buy(parse("10"));

    const purchaseTime = await sale.firstPurchaseTime(buyer.address);

    await ethers.provider.send("evm_setNextBlockTimestamp", [
      Number(purchaseTime) + 86400
    ]);

    await mining.connect(buyer).claim();

    expect(await token.balanceOf(buyer.address))
      .to.equal(parse("150.5"));
    expect(await mining.totalRewardsPaid())
      .to.equal(parse("0.5"));
  });

  it("should expose the configured 1 percent daily rate", async function () {
    expect(await mining.DAILY_RATE()).to.equal(100n);
    expect(await mining.RATE_DENOMINATOR()).to.equal(10000n);
  });
});
