import { HardhatUserConfig } from "hardhat/config"
import "@nomicfoundation/hardhat-toolbox"
import "@nomicfoundation/hardhat-chai-matchers"
import '@openzeppelin/hardhat-upgrades';
import "hardhat-contract-sizer"

require("dotenv").config()

const networks = {
  mainnet: {
    url: "https://rpc.ankr.com/eth",
    chainId: 1,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  sepolia: {
    url: "https://rpc.ankr.com/eth_sepolia",
    chainId: 11155111,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  goerli: {
    url: "https://rpc.ankr.com/eth_goerli",
    chainId: 5,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  bscTestnet: {
    url: "https://bsc-testnet.publicnode.com",
    chainId: 97,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  polygonMumbai: {
    url: `https://rpc.ankr.com/polygon_mumbai/`,
    chainId: 80001,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()!],
  },
  gnosis: {
    url: `https://rpc.ankr.com/gnosis/${process.env.ANKR_KEY}`,
    chainId: 100,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  idchain: {
    url: "https://idchain.one/rpc/",
    chainId: 74,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  ftm: {
    url: `https://rpc.ankr.com/fantom/${process.env.ANKR_KEY}`,
    chainId: 250,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  polygon: {
    url: `https://rpc.ankr.com/polygon/${process.env.ANKR_KEY}`,
    chainId: 137,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  bsc: {
    url: "https://rpc.ankr.com/bsc",
    //${process.env.ANKR_KEY}`,
    chainId: 56,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  optimism: {
    url: "https://rpc.ankr.com/optimism",
    //${process.env.ANKR_KEY}`,
    chainId: 10,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
  arb: {
    url: "https://arb1.arbitrum.io/rpc",
    //${process.env.ANKR_KEY}`,
    chainId: 42161,
    accounts: [process.env.PRIVATE_KEY || missing_privateKey()],
  },
}

function missing_privateKey() {
  throw Error("PrivateKey missing")
}

task(
  "account",
  "returns nonce and balance for specified address on multiple networks",
)
  .addParam("address")
  .setAction(async (taskArgs) => {
    let resultArr = Object.keys(networks).map(async (network) => {
      const config = networks[network]
      const web3 = new Web3(config["url"])

      const nonce = await web3.eth.getTransactionCount(
        taskArgs.address,
        "latest",
      )
      const balance = await web3.eth.getBalance(taskArgs.address)

      return [
        network,
        nonce,
        parseFloat(web3.utils.fromWei(balance, "ether")).toFixed(2) + "ETH",
      ]
    })

    await Promise.all(resultArr).then((resultArr) => {
      resultArr.unshift(["NETWORK | NONCE | BALANCE"])
      console.log(resultArr)
    })
  })

task("verify-cli", "verify contract on the specified network")
  .addParam("address")
  .setAction(async (taskArgs) => {
    const verify = require("./scripts/verify")

    await verify(taskArgs.address)
  })

module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
    },
    ...networks,
  },
  solidity: {
    compilers: [{ version: "0.8.20" }, { version: "0.4.18" }],
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 40000,
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_KEY,
      sepolia: process.env.ETHERSCAN_KEY,
      goerli: process.env.ETHERSCAN_KEY,
      bscTestnet: process.env.BSCSCAN_KEY,
      polygonMumbai: process.env.POLYGON_KEY,
      gnosis: process.env.GNOSISSCAN_KEY,
      ftm: process.env.FTMSCAN_KEY,
      polygon: process.env.POLYGONSCAN_KEY,
      bsc: process.env.BSCSCAN_KEY,
      optimisticEthereum: process.env.OPT_SCAN,
      arbitrumOne: process.env.ARB_SCAN,
    },
    customChains: [
      {
        network: "ftm",
        chainId: 250,
        urls: {
          apiURL: "https://ftmscan.com/",
          browserURL: "https://ftmscan.com/",
        },
      },
    ],
  },
}
