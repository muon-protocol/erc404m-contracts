import { expect } from "chai"
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers"
import { ethers } from "hardhat"

describe("ERC404", function () {
  async function deployExampleERC404() {
    const signers = await ethers.getSigners()
    const factory = await ethers.getContractFactory("ExampleERC404")

    const name = "Example"
    const symbol = "EXM"
    const decimals = 18n
    const units = 10n ** decimals
    const maxTotalSupplyERC721 = 100n
    const maxTotalSupplyERC20 = maxTotalSupplyERC721 * units
    const initialOwner = signers[0].address
    const initialMintRecipient = signers[0].address

    const contract = await factory.deploy(
      name,
      symbol,
      decimals,
      maxTotalSupplyERC721,
      initialOwner,
      initialMintRecipient,
    )
    await contract.waitForDeployment()
    const contractAddress = await contract.getAddress()

    // Generate 10 random addresses for experiments.
    const randomAddresses = Array.from(
      { length: 10 },
      () => ethers.Wallet.createRandom().address,
    )

    return {
      contract,
      contractAddress,
      signers,
      deployConfig: {
        name,
        symbol,
        decimals,
        units,
        maxTotalSupplyERC721,
        maxTotalSupplyERC20,
        initialOwner,
        initialMintRecipient,
      },
      randomAddresses,
    }
  }

  async function deployMinimalERC404() {
    const signers = await ethers.getSigners()
    const factory = await ethers.getContractFactory("MinimalERC404")

    const name = "Example"
    const symbol = "EXM"
    const decimals = 18n
    const units = 10n ** decimals
    const maxTotalSupplyERC721 = 100n
    const maxTotalSupplyERC20 = maxTotalSupplyERC721 * units
    const initialOwner = signers[0].address

    const contract = await factory.deploy(
      name,
      symbol,
      decimals,
      maxTotalSupplyERC721,
      initialOwner,
    )
    await contract.waitForDeployment()
    const contractAddress = await contract.getAddress()

    // Generate 10 random addresses for experiments.
    const randomAddresses = Array.from(
      { length: 10 },
      () => ethers.Wallet.createRandom().address,
    )

    return {
      contract,
      contractAddress,
      signers,
      deployConfig: {
        name,
        symbol,
        decimals,
        units,
        maxTotalSupplyERC721,
        maxTotalSupplyERC20,
        initialOwner,
      },
      randomAddresses,
    }
  }

  async function deployExampleERC404WithTokensInSecondSigner() {
    const f = await loadFixture(deployExampleERC404)
    const from = f.signers[1]
    const to = f.signers[2]

    // Start off with 100 full tokens.
    const initialExperimentBalanceERC721 = 100n
    const initialExperimentBalanceERC20 =
      initialExperimentBalanceERC721 * f.deployConfig.units

    const balancesBeforeSigner0 = await getBalances(
      f.contract,
      f.signers[0].address,
    )
    const balancesBeforeSigner1 = await getBalances(
      f.contract,
      f.signers[1].address,
    )

    // console.log("balancesBeforeSigner0", balancesBeforeSigner0)
    // console.log("balancesBeforeSigner1", balancesBeforeSigner1)

    // Add the owner to the whitelist
    await f.contract
      .connect(f.signers[0])
      .setWhitelist(f.signers[0].address, true)

    // Transfer all tokens from the owner to 'from', who is the initial sender for the tests.
    await f.contract
      .connect(f.signers[0])
      .transfer(from.address, initialExperimentBalanceERC20)

    return {
      ...f,
      initialExperimentBalanceERC20,
      initialExperimentBalanceERC721,
      from,
      to,
    }
  }

  async function getBalances(contract: any, address: string) {
    return {
      erc20: await contract.erc20BalanceOf(address),
      erc721: await contract.erc721BalanceOf(address),
    }
  }

  describe("#constructor", function () {
    it("Initializes the contract with the expected values", async function () {
      const f = await loadFixture(deployExampleERC404)

      expect(await f.contract.name()).to.equal(f.deployConfig.name)
      expect(await f.contract.symbol()).to.equal(f.deployConfig.symbol)
      expect(await f.contract.decimals()).to.equal(f.deployConfig.decimals)
      expect(await f.contract.maxTotalSupplyERC721()).to.equal(
        f.deployConfig.maxTotalSupplyERC721,
      )
      expect(await f.contract.owner()).to.equal(f.deployConfig.initialOwner)
      expect(await f.contract.maxTotalSupplyERC20()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )
    })

    it("Mints the initial supply of tokens to the initial mint recipient", async function () {
      const f = await loadFixture(deployExampleERC404)

      // Expect full supply of ERC20 tokens to be minted to the initial recipient.
      expect(
        await f.contract.erc20BalanceOf(f.deployConfig.initialMintRecipient),
      ).to.equal(f.deployConfig.maxTotalSupplyERC20)
      // Expect 0 ERC721 tokens to be minted to the initial recipient, since 1) the user is on the whitelist and 2) the supply is minted using _mintERC20 with mintCorrespondingERC721s_ set to false.
      expect(
        await f.contract.erc721BalanceOf(f.deployConfig.initialMintRecipient),
      ).to.equal(0n)

      // NFT minted count should be 0.
      expect(await f.contract.minted()).to.equal(0n)

      // Total supply of ERC20s tokens should be equal to the initial mint recipient's balance.
      expect(await f.contract.totalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )
    })

    it("Initializes the whitelist with the initial mint recipient", async function () {
      const f = await loadFixture(deployExampleERC404)

      expect(
        await f.contract.whitelist(f.deployConfig.initialMintRecipient),
      ).to.equal(true)
    })
  })

  describe.skip("#erc721BalanceOf", function () {})

  describe.skip("#erc20BalanceOf", function () {})

  describe("#ownerOf", function () {
    context("Some tokens have been minted", function () {
      it("Reverts if the token ID does not exist", async function () {
        const f = await loadFixture(deployExampleERC404)

        await expect(f.contract.ownerOf(11n)).to.be.revertedWithCustomError(
          f.contract,
          "NotFound",
        )
      })

      it("Reverts if the token ID is 0", async function () {
        const f = await loadFixture(deployExampleERC404)

        await expect(f.contract.ownerOf(0n)).to.be.revertedWithCustomError(
          f.contract,
          "NotFound",
        )
      })
    })
  })

  describe("Enforcement of max total supply limits", function () {
    it("Allows minting of the full supply of ERC20 + ERC721 tokens", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
          true,
        )

      // Expect the minted count to be equal to the max total supply
      expect(await f.contract.minted()).to.equal(
        f.deployConfig.maxTotalSupplyERC721,
      )
    })

    it("Allows minting of the full supply of ERC20 tokens only", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
          false,
        )

      // Expect the total supply to be equal to the max total supply
      expect(await f.contract.totalSupply()).to.equal(
        f.deployConfig.maxTotalSupplyERC20,
      )
      expect(await f.contract.minted()).to.equal(0n)
    })

    it("Prevents minting of ERC721 tokens beyond the max total supply", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
          true,
        )

      // Attempt to mint an additional ERC721 token
      await expect(
        f.contract
          .connect(f.signers[0])
          .mintERC20(f.signers[1].address, 1n * f.deployConfig.units, true),
      ).to.be.revertedWithCustomError(f.contract, "MaxERC20SupplyReached")
    })

    it("Prevents minting of ERC20 tokens beyond the max total supply", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Owner mints the full supply of ERC20 tokens (with the corresponding ERC721 tokens minted as well)
      await f.contract
        .connect(f.signers[0])
        .mintERC20(
          f.signers[1].address,
          f.deployConfig.maxTotalSupplyERC721 * f.deployConfig.units,
          true,
        )

      // Attempt to mint an additional ERC20 wei
      await expect(
        f.contract
          .connect(f.signers[0])
          .mintERC20(f.signers[1].address, 1n, true),
      ).to.be.revertedWithCustomError(f.contract, "MaxERC20SupplyReached")
    })
  })

  describe("Storage and retrieval of unused ERC721s on contract", function () {
    it("Mints ERC721s from 0x0 when the contract's bank is empty", async function () {
      const f = await loadFixture(deployMinimalERC404)

      // Expect the contract's bank to be empty
      // TODO: for now we can only check the minted count as the balance is not updated for the contract.
      expect(await f.contract.minted()).to.equal(0n)

      const nftQty = 10n
      const value = nftQty * f.deployConfig.units

      // Mint 10 ERC721s
      const mintTx = await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, value, true)

      // Check for ERC721Transfer mint events (from 0x0 to the recipient)
      for (let i = 1n; i <= nftQty; i++) {
        await expect(mintTx)
          .to.emit(f.contract, "ERC721Transfer")
          .withArgs(ethers.ZeroAddress, f.signers[1].address, i)
        await expect(mintTx)
          .to.emit(f.contract, "Transfer")
          .withArgs(ethers.ZeroAddress, f.signers[1].address, i)
      }

      // Check for ERC20Transfer mint events (from 0x0 to the recipient)
      await expect(mintTx)
        .to.emit(f.contract, "ERC20Transfer")
        .withArgs(ethers.ZeroAddress, f.signers[1].address, value)
      await expect(mintTx)
        .to.emit(f.contract, "Transfer")
        .withArgs(ethers.ZeroAddress, f.signers[1].address, value)

      // 10 NFTs should have been minted
      expect(await f.contract.minted()).to.equal(10n)

      // Expect
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        10n,
      )
    })

    it("Stores ERC721s in contract's bank when a sender loses a full token", async function () {
      const f = await loadFixture(deployMinimalERC404)

      expect(await f.contract.minted()).to.equal(0n)

      const nftQty = 10n
      const value = nftQty * f.deployConfig.units

      await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, value, true)

      expect(await f.contract.minted()).to.equal(10n)

      // The contract's NFT balance should be 0
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)

      // Move a fraction of a token to another address to break apart a full NFT.

      const fractionalValueToTransferERC20 = f.deployConfig.units / 10n // 0.1 tokens
      const fractionalTransferTx = await f.contract
        .connect(f.signers[1])
        .transfer(f.signers[2].address, fractionalValueToTransferERC20)

      await expect(fractionalTransferTx)
        .to.emit(f.contract, "Transfer")
        .withArgs(
          f.signers[1].address,
          f.signers[2].address,
          fractionalValueToTransferERC20,
        )

      await expect(fractionalTransferTx)
        .to.emit(f.contract, "ERC20Transfer")
        .withArgs(
          f.signers[1].address,
          f.signers[2].address,
          fractionalValueToTransferERC20,
        )

      // Expect token id 10 to be transferred to the contract's address (popping the last NFT from the sender's stack)
      await expect(fractionalTransferTx)
        .to.emit(f.contract, "ERC721Transfer")
        .withArgs(f.signers[1].address, f.contractAddress, 10n)

      // 10 tokens still minted, nothing changes there.
      expect(await f.contract.minted()).to.equal(10n)

      // The owner of NFT 10 should be the contract's address
      expect(await f.contract.ownerOf(10n)).to.equal(f.contractAddress)

      // The sender's NFT balance should be 9
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        9n,
      )

      // The contract's NFT balance should be 1
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(1n)
    })

    it("Retrieves ERC721s from the contract's bank when the contract's bank holds NFTs and the user regains a full token", async function () {
      const f = await loadFixture(deployMinimalERC404)

      expect(await f.contract.minted()).to.equal(0n)

      const nftQty = 10n
      const erc20Value = nftQty * f.deployConfig.units

      await f.contract
        .connect(f.signers[0])
        .mintERC20(f.signers[1].address, erc20Value, true)

      expect(await f.contract.minted()).to.equal(10n)

      // Move a fraction of a token to another address to break apart a full NFT.
      const fractionalValueToTransferERC20 = f.deployConfig.units / 10n // 0.1 tokens

      await f.contract
        .connect(f.signers[1])
        .transfer(f.signers[2].address, fractionalValueToTransferERC20)

      // The owner of NFT 9 should be the contract's address
      expect(await f.contract.ownerOf(10n)).to.equal(f.contractAddress)

      // The sender's NFT balance should be 9
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        9n,
      )

      // The contract's NFT balance should be 1
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(1n)

      // Transfer the fractional portion needed to regain a full token back to the original sender
      const regainFullTokenTx = await f.contract
        .connect(f.signers[2])
        .transfer(f.signers[1].address, fractionalValueToTransferERC20)

      expect(regainFullTokenTx)
        .to.emit(f.contract, "Transfer")
        .withArgs(
          f.signers[2].address,
          f.signers[1].address,
          fractionalValueToTransferERC20,
        )
      expect(regainFullTokenTx)
        .to.emit(f.contract, "ERC20Transfer")
        .withArgs(
          f.signers[2].address,
          f.signers[1].address,
          fractionalValueToTransferERC20,
        )
      expect(regainFullTokenTx)
        .to.emit(f.contract, "ERC721Transfer")
        .withArgs(f.contractAddress, f.signers[1].address, 9n)

      // Original sender's ERC20 balance should be 10 * units
      expect(await f.contract.erc20BalanceOf(f.signers[1].address)).to.equal(
        erc20Value,
      )

      // The owner of NFT 9 should be the original sender's address
      expect(await f.contract.ownerOf(10n)).to.equal(f.signers[1].address)

      // The sender's NFT balance should be 10
      expect(await f.contract.erc721BalanceOf(f.signers[1].address)).to.equal(
        10n,
      )

      // The contract's NFT balance should be 0
      expect(await f.contract.erc721BalanceOf(f.contractAddress)).to.equal(0n)
    })
  })

  describe("ERC20 token transfer logic for triggering ERC721 transfers", function () {
    context(
      "Fractional transfers (moving less than 1 full token) that trigger ERC721 transfers",
      async function () {
        it("Handles the case of the receiver gaining a whole new token", async function () {
          const f = await loadFixture(
            deployExampleERC404WithTokensInSecondSigner,
          )

          // Receiver starts out with 0.9 tokens
          const startingBalanceOfReceiver = (f.deployConfig.units / 10n) * 9n // 0.9 tokens
          await f.contract
            .connect(f.from)
            .transfer(f.to.address, startingBalanceOfReceiver)

          // Initial balances
          const fromBalancesBefore = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesBefore = await getBalances(f.contract, f.to.address)

          // console.log("fromBalancesBefore", fromBalancesBefore)
          // console.log("toBalancesBefore", toBalancesBefore)

          // Ensure that the receiver has 0.9 tokens and 0 NFTs.
          expect(toBalancesBefore.erc20).to.equal(startingBalanceOfReceiver)
          expect(toBalancesBefore.erc721).to.equal(0n)

          // Transfer an amount that results in the receiver gaining a whole new token (0.9 + 0.1)
          const fractionalValueToTransferERC20 = f.deployConfig.units / 10n // 0.1 tokens
          await f.contract
            .connect(f.from)
            .transfer(f.to.address, fractionalValueToTransferERC20)

          // Post-transfer balances
          const fromBalancesAfter = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesAfter = await getBalances(f.contract, f.to.address)

          // console.log("fromBalancesAfter", fromBalancesAfter)
          // console.log("toBalancesAfter", toBalancesAfter)

          // Verify ERC20 balances after transfer
          expect(fromBalancesAfter.erc20).to.equal(
            fromBalancesBefore.erc20 - fractionalValueToTransferERC20,
          )
          expect(toBalancesAfter.erc20).to.equal(
            toBalancesBefore.erc20 + fractionalValueToTransferERC20,
          )

          // Verify ERC721 balances after transfer
          // Assuming the receiver should have gained 1 NFT due to the transfer completing a whole token
          expect(fromBalancesAfter.erc721).to.equal(fromBalancesBefore.erc721) // No change for the sender
          expect(toBalancesAfter.erc721).to.equal(toBalancesBefore.erc721 + 1n)
        })

        it("Handles the case of the sender losing a partial token, dropping it below a full token", async function () {
          const f = await loadFixture(
            deployExampleERC404WithTokensInSecondSigner,
          )

          // Initial balances
          const fromBalancesBefore = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesBefore = await getBalances(f.contract, f.to.address)

          expect(fromBalancesBefore.erc20 / f.deployConfig.units).to.equal(100n)

          // Sender starts with 100 tokens and sends 0.1, resulting in the loss of 1 NFT but no NFT transfer to the receiver.
          const initialFractionalAmount = f.deployConfig.units / 10n // 0.1 token in sub-units
          const transferAmount = initialFractionalAmount * 1n // 0.1 tokens, ensuring a loss of a whole token after transfer

          // Perform the transfer
          await f.contract
            .connect(f.from)
            .transfer(f.to.address, transferAmount)

          // Post-transfer balances
          const fromBalancesAfter = await getBalances(
            f.contract,
            f.from.address,
          )
          const toBalancesAfter = await getBalances(f.contract, f.to.address)

          // Verify ERC20 balances after transfer
          expect(fromBalancesAfter.erc20).to.equal(
            fromBalancesBefore.erc20 - transferAmount,
          )
          expect(toBalancesAfter.erc20).to.equal(
            toBalancesBefore.erc20 + transferAmount,
          )

          // Verify ERC721 balances after transfer
          // Assuming the sender should lose 1 NFT due to the transfer causing a loss of a whole token.
          // Sender loses an NFT
          expect(fromBalancesAfter.erc721).to.equal(
            fromBalancesBefore.erc721 - 1n,
          )
          // No NFT gain for the receiver
          expect(toBalancesAfter.erc721).to.equal(toBalancesBefore.erc721)
          // Contract gains an NFT (it's stored in the contract in this scenario).
          // TODO - Verify this with the contract's balance.
        })
      },
    )

    context("Moving one or more full tokens", async function () {
      it("Transfers whole tokens without fractional impact correctly", async function () {
        const f = await loadFixture(deployExampleERC404WithTokensInSecondSigner)

        // Initial balances
        const fromBalancesBefore = await getBalances(f.contract, f.from.address)
        const toBalancesBefore = await getBalances(f.contract, f.to.address)

        // Expect initial balances to match setup
        expect(fromBalancesBefore.erc20).to.equal(
          f.initialExperimentBalanceERC20,
        )
        expect(fromBalancesBefore.erc721).to.equal(
          f.initialExperimentBalanceERC721,
        )
        expect(toBalancesBefore.erc20).to.equal(0n)
        expect(toBalancesBefore.erc721).to.equal(0n)

        // Transfer 2 whole tokens
        const erc721TokensToTransfer = 2n
        const valueToTransferERC20 =
          erc721TokensToTransfer * f.deployConfig.units
        await f.contract
          .connect(f.from)
          .transfer(f.to.address, valueToTransferERC20)

        // Post-transfer balances
        const fromBalancesAfter = await getBalances(f.contract, f.from.address)
        const toBalancesAfter = await getBalances(f.contract, f.to.address)

        // Verify ERC20 balances after transfer
        expect(fromBalancesAfter.erc20).to.equal(
          fromBalancesBefore.erc20 - valueToTransferERC20,
        )
        expect(toBalancesAfter.erc20).to.equal(
          toBalancesBefore.erc20 + valueToTransferERC20,
        )

        // Verify ERC721 balances after transfer - Assuming 2 NFTs should have been transferred
        expect(fromBalancesAfter.erc721).to.equal(
          fromBalancesBefore.erc721 - erc721TokensToTransfer,
        )
        expect(toBalancesAfter.erc721).to.equal(
          toBalancesBefore.erc721 + erc721TokensToTransfer,
        )
      })

      it("Handles the case of sending 3.2 tokens where the sender started out with 99.1 tokens and the receiver started with 0.9 tokens", async function () {
        // This test demonstrates all 3 cases in one scenario:
        // - The sender loses a partial token, dropping it below a full token (99.1 - 3.2 = 95.9)
        // - The receiver gains a whole new token (0.9 + 3.2 (3 whole, 0.2 fractional) = 4.1)
        // - The sender transfers 3 whole tokens to the receiver (99.1 - 3.2 (3 whole, 0.2 fractional) = 95.9)

        const f = await loadFixture(deployExampleERC404WithTokensInSecondSigner)

        // Receiver starts out with 0.9 tokens
        const startingBalanceOfReceiver = (f.deployConfig.units / 10n) * 9n // 0.9 tokens
        await f.contract
          .connect(f.from)
          .transfer(f.to.address, startingBalanceOfReceiver)

        // Initial balances
        const fromBalancesBefore = await getBalances(f.contract, f.from.address)
        const toBalancesBefore = await getBalances(f.contract, f.to.address)

        // console.log("fromBalancesBefore", fromBalancesBefore)
        // console.log("toBalancesBefore", toBalancesBefore)

        // Ensure that the receiver has 0.9 tokens and 0 NFTs.
        expect(toBalancesBefore.erc20).to.equal(startingBalanceOfReceiver)
        expect(toBalancesBefore.erc721).to.equal(0n)

        // Transfer an amount that results in:
        // - the receiver gaining a whole new token (0.9 + 0.2 + 3)
        // - the sender losing a partial token, dropping it below a full token (99.1 - 3.2 = 95.9)
        const fractionalValueToTransferERC20 =
          (f.deployConfig.units / 10n) * 32n // 3.2 tokens
        await f.contract
          .connect(f.from)
          .transfer(f.to.address, fractionalValueToTransferERC20)

        // Post-transfer balances
        const fromBalancesAfter = await getBalances(f.contract, f.from.address)
        const toBalancesAfter = await getBalances(f.contract, f.to.address)

        // console.log("fromBalancesAfter", fromBalancesAfter)
        // console.log("toBalancesAfter", toBalancesAfter)

        // Verify ERC20 balances after transfer
        expect(fromBalancesAfter.erc20).to.equal(
          fromBalancesBefore.erc20 - fractionalValueToTransferERC20,
        )
        expect(toBalancesAfter.erc20).to.equal(
          toBalancesBefore.erc20 + fractionalValueToTransferERC20,
        )

        // Verify ERC721 balances after transfer
        // The receiver should have gained 3 NFTs from the transfer and 1 NFT due to the transfer completing a whole token for a total of +4 NFTs.
        expect(fromBalancesAfter.erc721).to.equal(
          fromBalancesBefore.erc721 - 4n,
        )
        expect(toBalancesAfter.erc721).to.equal(toBalancesBefore.erc721 + 4n)
      })
    })
  })

  describe("Minting and burning tokens (ERC20 & ERC721)", function () {
    it("Doesn't allow anyone to transfer from 0x0", async function () {
      const f = await loadFixture(deployExampleERC404)

      // Attempt to transfer from 0x0. This will always fail as it's not possible for the 0x0 address to sign a transaction, so it can neither send a transfer nor give another address an allowance.
      await expect(
        f.contract
          .connect(f.signers[0])
          .transferFrom(ethers.ZeroAddress, f.signers[1].address, 1n),
      ).to.be.revertedWithCustomError(f.contract, "InsufficientAllowance")
    })
  })

  describe("#transfer", function () {
    it("Reverts when attempting to transfer anything to 0x0", async function () {
      const f = await loadFixture(deployExampleERC404)

      // Attempt to transfer to 0x0. This will always fail as it's not possible for the 0x0 address to receive a transfer.
      await expect(
        f.contract.connect(f.signers[0]).transfer(ethers.ZeroAddress, 1n),
      ).to.be.revertedWithCustomError(f.contract, "InvalidRecipient")
    })
  })

  describe("#_setWhitelist", function () {
    it("Allows the owner to add and remove addresses from the whitelist", async function () {
      const f = await loadFixture(deployExampleERC404)

      expect(await f.contract.whitelist(f.randomAddresses[1])).to.equal(false)

      // Add a random address to the whitelist
      await f.contract
        .connect(f.signers[0])
        .setWhitelist(f.randomAddresses[1], true)
      expect(await f.contract.whitelist(f.randomAddresses[1])).to.equal(true)

      // Remove the random address from the whitelist
      await f.contract
        .connect(f.signers[0])
        .setWhitelist(f.randomAddresses[1], false)
      expect(await f.contract.whitelist(f.randomAddresses[1])).to.equal(false)
    })

    it("An address cannot be removed from the whitelist while it has an ERC-20 balance >= 1 full token.", async function () {
      const f = await loadFixture(deployExampleERC404)

      const targetAddress = f.randomAddresses[0]

      // Transfer 1 full NFT worth of tokens to that address.
      await f.contract
        .connect(f.signers[0])
        .transfer(targetAddress, f.deployConfig.units)

      expect(await f.contract.erc721BalanceOf(targetAddress)).to.equal(1n)

      // Add that address to the whitelist.
      await f.contract.connect(f.signers[0]).setWhitelist(targetAddress, true)

      // Attempt to remove the random address from the whitelist.
      await expect(
        f.contract.connect(f.signers[0]).setWhitelist(targetAddress, false),
      ).to.be.revertedWithCustomError(f.contract, "CannotRemoveFromWhitelist")
    })
  })

  describe("#transferFrom", function () {})
})
