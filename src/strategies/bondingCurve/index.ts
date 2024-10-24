import { ethers } from "ethers";
import { BondingCurveStrategy } from "./bondingCurve";
import dotenv from "dotenv";

dotenv.config();

async function startBondingCurveStrategy() {
    const args = process.argv.slice(2);

    if (args.length < 6) {
        console.error("Please provide all required arguments: chainID, providerUrl, baseAddress, quoteAddress, userAddress, pollInterval, [orderLadderSize]");
        process.exit(1);
    }

    const chainID = parseInt(args[0], 10);
    const providerUrl = args[1];
    const baseAddress = args[2];
    const quoteAddress = args[3];
    const userAddress = args[4];
    const pollInterval = parseInt(args[5], 10);
    const orderLadderSize = args[6] ? parseInt(args[6], 10) : 5;

    const provider = new ethers.providers.JsonRpcProvider(providerUrl);

    if (!process.env.PRIVATE_KEY) {
        console.error("Please provide a private key in the .env file");
        process.exit(1);
    }
    const userWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const strategy = new BondingCurveStrategy(
        chainID,
        userWallet,
        userAddress,
        baseAddress,
        quoteAddress,
        pollInterval,
        orderLadderSize
    );

    await strategy.runStrategy();
}

startBondingCurveStrategy().catch((error) => {
    console.error("Error starting Bonding Curve Strategy:", error);
    process.exit(1);
});
