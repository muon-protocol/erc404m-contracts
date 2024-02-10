import { ethers } from "hardhat"

async function main() {
  const contract = await ethers.deployContract("ERC404m", [
    "0xb57490CDAABEDb450df33EfCdd93079A24ac5Ce5",
    "0xb57490CDAABEDb450df33EfCdd93079A24ac5Ce5",
    "https://erc404-metadata.muon.net/"
  ])

  await contract.deployed()

  console.log(`contract deployed to ${contract.address}`)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
