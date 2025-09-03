import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MarketV2Module", (m) => {
  const deployer = m.getAccount(0);
  const marketV2 = m.contract("MarketplaceV2", [deployer, deployer, 250n], { from: deployer });
  return { marketV2 };
});
