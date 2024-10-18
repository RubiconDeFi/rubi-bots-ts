import { ethers } from "ethers";
import { BondingCurveStrategy } from "./bondingCurve";

async function startBondingCurveStrategy() {
    const args = process.argv.slice(2);

    if (args.length < 8) {
        console.error("Please provide all required arguments: chainID, providerUrl, baseAddress, quoteAddress, reserveRatio, initialSupply, initialPrice, fundsHolderAddress");
        process.exit(1);
    }

    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseAddress = args[2];
    const quoteAddress = args[3];
    const reserveRatio = parseFloat(args[4]);
    const initialSupply = args[5];
    const initialPrice = parseFloat(args[6]);
    const fundsHolderAddress = ethers.utils.getAddress(args[7]);
    const pollInterval = args[8] ? parseInt(args[8], 10) : 5000;

    const provider = new ethers.providers.JsonRpcProvider(providerUrl);

    if (!process.env.PRIVATE_KEY) {
        console.error("Please provide a private key in the .env file");
        process.exit(1);
    }
    const userWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const strategy = new BondingCurveStrategy(
        chainID,
        userWallet,
        fundsHolderAddress,
        baseAddress,
        quoteAddress,
        reserveRatio,
        initialSupply,
        initialPrice,
        pollInterval
    );

    strategy.runStrategy();
}

startBondingCurveStrategy().catch((error) => {
    console.error("Error starting Bonding Curve Strategy:", error);
    process.exit(1);
});