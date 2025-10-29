import { ethers } from "hardhat";

async function main() {
  console.log("Deploying GladiusFiller contract...");

  const GladiusFiller = await ethers.getContractFactory("GladiusFiller");
  const gladiusFiller = await GladiusFiller.deploy();

  await gladiusFiller.deployed();

  console.log("GladiusFiller deployed to:", gladiusFiller.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
