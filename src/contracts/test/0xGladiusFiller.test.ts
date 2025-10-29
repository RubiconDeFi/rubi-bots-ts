import { expect } from "chai";
import hre from "hardhat";

describe("0xGladiusFiller", function () {
  let oxGladiusFiller: any;
  let owner: any;
  let addr1: any;

  beforeEach(async function () {
    // Get signers (ethers v6)
    [owner, addr1] = await hre.ethers.getSigners();

    // Deploy 0xGladiusFiller contract
    const OxGladiusFiller = await hre.ethers.getContractFactory("OxGladiusFiller");
    oxGladiusFiller = await OxGladiusFiller.deploy();
    await oxGladiusFiller.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await oxGladiusFiller.owner()).to.equal(owner.address);
    });

    it("Should have zero filled orders initially", async function () {
      const testOrderHash = hre.ethers.keccak256("0x1234");
      expect(await oxGladiusFiller.isOrderFilled(testOrderHash)).to.equal(false);
    });

    it("Should return correct filler name", async function () {
      expect(await oxGladiusFiller.fillerName()).to.equal("0x");
    });
  });

  describe("Order Filling", function () {
    it("Should fill an order successfully", async function () {
      const testOrderHash = hre.ethers.keccak256("0x5678");
      const fillAmount = hre.ethers.parseEther("1.0");
      const swapData = "0x1234"; // Mock 0x swap data

      await expect(
        oxGladiusFiller.fillGladiusOrder(testOrderHash, fillAmount, swapData)
      )
        .to.emit(oxGladiusFiller, "OrderFilled")
        .withArgs(testOrderHash, owner.address, fillAmount, "0x");

      expect(await oxGladiusFiller.isOrderFilled(testOrderHash)).to.equal(true);
    });

    it("Should prevent filling the same order twice", async function () {
      const testOrderHash = hre.ethers.keccak256("0xabcd");
      const fillAmount = hre.ethers.parseEther("1.0");
      const swapData = "0x1234";

      // First fill should succeed
      await oxGladiusFiller.fillGladiusOrder(testOrderHash, fillAmount, swapData);

      // Second fill should fail
      await expect(
        oxGladiusFiller.fillGladiusOrder(testOrderHash, fillAmount, swapData)
      ).to.be.revertedWith("Order already filled");
    });

    it("Should require non-empty swap data", async function () {
      const testOrderHash = hre.ethers.keccak256("0xdef0");
      const fillAmount = hre.ethers.parseEther("1.0");
      const swapData = "0x"; // Empty swap data

      await expect(
        oxGladiusFiller.fillGladiusOrder(testOrderHash, fillAmount, swapData)
      ).to.be.revertedWith("Invalid swap data");
    });
  });

  describe("Interface Compliance", function () {
    it("Should implement IGladiusFiller interface", async function () {
      // Verify all interface methods exist and work
      const testOrderHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("test"));
      
      expect(await oxGladiusFiller.isOrderFilled(testOrderHash)).to.equal(false);
      expect(await oxGladiusFiller.fillerName()).to.equal("0x");
    });
  });
});

