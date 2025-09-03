import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("MarketModule", (m) => {
  const deployer = m.getAccount(0);
  const market = m.contract("Marketplace", [deployer, deployer, 250n], { from: deployer });
  return { market };
});
