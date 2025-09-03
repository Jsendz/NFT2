import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NFTModule", (m) => {
  const deployer = m.getAccount(0);
  const nft = m.contract("TestNFT", [deployer, deployer, 500n], { from: deployer });
  return { nft };
});
