import { writeFileSync, readFileSync } from "fs";
import { join } from "path";

// Update this CHAIN_ID if deploying to a different network
const CHAIN_ID = "11155111"; // Sepolia

const deployed = JSON.parse(
  readFileSync(
    join("ignition", "deployments", `chain-${CHAIN_ID}`, "deployed_addresses.json"),
    "utf8"
  )
);

// Adjust keys if you renamed futures in the module
const MARKET = deployed["MarketModule#Marketplace"];
const NFT = deployed["MarketModule#TestNFT"];

const env =
  `NEXT_PUBLIC_MARKETPLACE_ADDRESS=${MARKET}\n` +
  `NEXT_PUBLIC_NFT_ADDRESS=${NFT}\n`;

writeFileSync(join("frontend", ".env.local"), env);
console.log("Wrote frontend/.env.local with contract addresses");
