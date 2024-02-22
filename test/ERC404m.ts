import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect, } from "chai";
import { ethers } from "hardhat";
import { ERC404m } from "../typechain-types";
import { Signer, ContractReceipt } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";


describe("ERC404m", async () => {
  const rarityBytes = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";
  let adminWallet: Signer;
  let wallet1: Signer;
  let wallet2: Signer;
  let wallet3: Signer;
  let wallet4: Signer;
  let spender1: Signer;
  let mrc404Token: ERC404m;


  const deployMRC404 = async () => {
    const token = await ethers.deployContract("ERC404m", [""]);
    return token;
  }

  before(async () => {
    [
      adminWallet,
      wallet1,
      wallet2,
      wallet3,
      wallet4,
      spender1
    ] = await ethers.getSigners();
    mrc404Token = await loadFixture(deployMRC404);
  })

  describe("Minting", async () => {

    it("Should prevent mint because lack of access", async () => {
      await expect((
        mrc404Token.connect(wallet1).mint(wallet1.getAddress(), 2, rarityBytes)
      )).to.be.revertedWithCustomError(
        mrc404Token,
        'AccessControlUnauthorizedAccount'
      );
    })

    it("Should adminWallet mint 2 for wallet1 and mint 2 erc721", async () => {
      await expect(mrc404Token.connect(adminWallet).mint(wallet1.getAddress(), ethers.parseEther("2"), rarityBytes))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(ethers.ZeroAddress, wallet1.getAddress(), ethers.parseEther("2"))
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(ethers.ZeroAddress, wallet1.getAddress(), 1)
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(ethers.ZeroAddress, wallet1.getAddress(), 2)
      .to.emit(mrc404Token, "Transfer").withArgs(ethers.ZeroAddress, wallet1.getAddress(), 1)
      .to.emit(mrc404Token, "Transfer").withArgs(ethers.ZeroAddress, wallet1.getAddress(), 2);
      expect(await mrc404Token.erc20BalanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("2"));
      expect(await mrc404Token.erc721BalanceOf(wallet1.getAddress())).to.be.equal(2);
      expect(await mrc404Token.balanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("2"));
    })

    it("Should adminWallet mint .9 for wallet1 and no erc721 should mint", async () => {
      await expect(mrc404Token.connect(adminWallet).mint(wallet1.getAddress(), ethers.parseEther(".9"), rarityBytes))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(ethers.ZeroAddress, wallet1.getAddress(), ethers.parseEther(".9"))
      expect(await mrc404Token.erc20BalanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("2.9"));
      expect(await mrc404Token.erc721BalanceOf(wallet1.getAddress())).to.be.equal(2);
      expect(await mrc404Token.balanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("2.9"));
    })

    it("Should adminWallet mint 5 for wallet3 and mint 5 erc721", async () => {
      await expect(mrc404Token.connect(adminWallet).mint(wallet3.getAddress(), ethers.parseEther("5"), rarityBytes))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(ethers.ZeroAddress, wallet3.getAddress(), ethers.parseEther("5"))
      expect(await mrc404Token.erc20BalanceOf(wallet3.getAddress())).to.be.equal(ethers.parseEther("5"));
      expect(await mrc404Token.erc721BalanceOf(wallet3.getAddress())).to.be.equal(5);
      expect(await mrc404Token.ownerOf(3)).to.be.equal(wallet3.address);
      expect(await mrc404Token.ownerOf(5)).to.be.equal(wallet3.address);
      expect(await mrc404Token.ownerOf(7)).to.be.equal(wallet3.address);
    })

  })

  describe("Transfer", async () => {

    it("Should wallet1 transfer .9 to wallet2 and no erc721 transfer", async () => {
      await expect(mrc404Token.connect(wallet1).transfer(wallet2.getAddress(), ethers.parseEther(".9")))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(wallet1.getAddress(), wallet2.getAddress(), ethers.parseEther(".9"))

      expect(await mrc404Token.erc20BalanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("2"));
      expect(await mrc404Token.erc20BalanceOf(wallet2.getAddress())).to.be.equal(ethers.parseEther(".9"));
      expect(await mrc404Token.erc721BalanceOf(wallet1.getAddress())).to.be.equal(2);
      expect(await mrc404Token.erc721BalanceOf(wallet2.getAddress())).to.be.equal(0);
      expect(await mrc404Token.balanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("2"));
    })

    it("Should wallet1 transfer .1 to wallet2 & tokenId:2 burn from wallet1 and mint it for wallet2", async () => {
      // TokenId:2 burned from wallet1 and mint again for wallet2
      await expect(mrc404Token.connect(wallet1).transfer(wallet2.getAddress(), ethers.parseEther(".1")))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(wallet1.getAddress(), wallet2.getAddress(), ethers.parseEther(".1"))
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(wallet1.getAddress(), ethers.ZeroAddress, 2)
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(ethers.ZeroAddress, wallet2.getAddress(), 2);

      expect(await mrc404Token.erc20BalanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("1.9"));
      expect(await mrc404Token.erc20BalanceOf(wallet2.getAddress())).to.be.equal(ethers.parseEther("1"));
      expect(await mrc404Token.erc721BalanceOf(wallet1.getAddress())).to.be.equal(1);
      expect(await mrc404Token.erc721BalanceOf(wallet2.getAddress())).to.be.equal(1);
      expect(await mrc404Token.balanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("1.9"));
    })

    it("Should wallet2 transfer .1 to wallet4 & tokenId:2 burn from wallet2", async () => {
      // TokenId:2 burned from wallet1 and mint again for wallet2
      await expect(mrc404Token.connect(wallet2).transfer(wallet4.getAddress(), ethers.parseEther(".1")))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(wallet2.getAddress(), wallet4.getAddress(), ethers.parseEther(".1"))
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(wallet2.getAddress(), ethers.ZeroAddress, 2)
      // .to.emit(mrc404Token, "ERC721Transfer").withArgs(ethers.ZeroAddress, wallet4.getAddress(), 2);

      expect(await mrc404Token.erc20BalanceOf(wallet2.getAddress())).to.be.equal(ethers.parseEther(".9"));
      expect(await mrc404Token.erc20BalanceOf(wallet4.getAddress())).to.be.equal(ethers.parseEther(".1"));
      expect(await mrc404Token.erc721BalanceOf(wallet4.getAddress())).to.be.equal(0);
      expect(await mrc404Token.erc721BalanceOf(wallet2.getAddress())).to.be.equal(0);
    })

    it("Should wallet3 transfer .1 to wallet4 and 1 ERC721 should mint", async () => {
      // TokenId:2 burned from wallet1 and mint again for wallet4
      await expect(mrc404Token.connect(wallet3).transfer(wallet4.getAddress(), ethers.parseEther(".1")))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(wallet3.getAddress(), wallet4.getAddress(), ethers.parseEther(".1"))
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(wallet3.getAddress(), ethers.ZeroAddress, 7);

      expect(await mrc404Token.erc20BalanceOf(wallet3.getAddress())).to.be.equal(ethers.parseEther("4.9"));
      expect(await mrc404Token.erc20BalanceOf(wallet4.getAddress())).to.be.equal(ethers.parseEther(".2"));
      expect(await mrc404Token.erc721BalanceOf(wallet3.getAddress())).to.be.equal(4);
      expect(await mrc404Token.erc721BalanceOf(wallet4.getAddress())).to.be.equal(0);
      expect(await mrc404Token.balanceOf(wallet3.getAddress())).to.be.equal(ethers.parseEther("4.9"));
    })

    it("Should adminWallet mint 2 for wallet4 and mint tokenId:2 and tokenId:7 for wallet4", async () => {
      // It mints tokenIds that have been burned already
      await expect(mrc404Token.connect(adminWallet).mint(wallet4.getAddress(), ethers.parseEther("2"), rarityBytes))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(ethers.ZeroAddress, wallet4.getAddress(), ethers.parseEther("2"))
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(ethers.ZeroAddress, wallet4.getAddress(), 2)
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(ethers.ZeroAddress, wallet4.getAddress(), 7)
      .to.emit(mrc404Token, "Transfer").withArgs(ethers.ZeroAddress, wallet4.getAddress(), 2)
      .to.emit(mrc404Token, "Transfer").withArgs(ethers.ZeroAddress, wallet4.getAddress(), 7)
      expect(await mrc404Token.erc20BalanceOf(wallet4.getAddress())).to.be.equal(ethers.parseEther("2.2"));
      expect(await mrc404Token.erc721BalanceOf(wallet4.getAddress())).to.be.equal(2);
      expect(await mrc404Token.balanceOf(wallet4.getAddress())).to.be.equal(ethers.parseEther("2.2"));
      expect(await mrc404Token.ownerOf(2)).to.be.equal(wallet4.address);
      expect(await mrc404Token.ownerOf(7)).to.be.equal(wallet4.address);
    })

  })

  describe("Approval", async () => {
    before(async () => {
      [
        adminWallet,
        wallet1,
        wallet2,
        wallet3,
        wallet4,
        spender1
      ] = await ethers.getSigners();
      mrc404Token = await loadFixture(deployMRC404);
    })

    it("Should mint 10 tokens for wallet1", async () => {
      await mrc404Token.connect(adminWallet).mint(wallet1, ethers.parseEther("10"), rarityBytes);
    })

    it("Should wallet1 approve tokenId:1 for spender1", async () => {
      await expect(mrc404Token.connect(wallet1).approve(spender1.getAddress(), 1))
      .to.emit(mrc404Token, "ERC721Approval").withArgs(wallet1.getAddress(), spender1.getAddress(), 1)
      expect(await mrc404Token.getApproved(1)).to.be.equal(spender1.address);
    })

    it("Should wallet1 approve 2 tokens for spender1", async () => {
      await expect(mrc404Token.connect(wallet1).approve(spender1.getAddress(), ethers.parseEther("2")))
      .to.emit(mrc404Token, "ERC20Approval").withArgs(wallet1.getAddress(), spender1.getAddress(), ethers.parseEther("2"))
      expect(await mrc404Token.allowance(wallet1.getAddress(), spender1.getAddress())).to.be.equal(ethers.parseEther("2"));
    })

    it("Should prevent spender1 transfers tokenId:2 from wallet1 with custom error Unauthorized", async () => {
      await expect((
        mrc404Token.connect(spender1).transferFrom(wallet1.getAddress(), wallet2.getAddress(), 2)
      )).to.be.revertedWithCustomError(mrc404Token, "Unauthorized");
    })

    it("Should prevent spender1 transfers 2.1 tokens from wallet1 to wallet2 because of allowance", async () => {
      await expect((
        mrc404Token.connect(spender1).transferFrom(wallet1.getAddress(), wallet2.getAddress(), ethers.parseEther("2.1"))
      )).to.be.reverted;
    })

    it("Should spender1 transfers 2 tokens from wallet1 to wallet2 and tokenId:9,10", async () => {
      await expect(mrc404Token.connect(spender1).transferFrom(wallet1.getAddress(), wallet2.getAddress(), ethers.parseEther("2")))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(wallet1.getAddress(), wallet2.getAddress(), ethers.parseEther("2"))
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(wallet1.getAddress(), wallet2.getAddress(), 10)
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(wallet1.getAddress(), wallet2.getAddress(), 9)
    })

    it("Should spender1 transfers tokenId:1 to wallet2", async () => {
      await expect(mrc404Token.connect(spender1).transferFrom(wallet1.getAddress(), wallet2.getAddress(), 1))
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(wallet1.getAddress(), wallet2.getAddress(), 1)
    })

    it("Should mint 10 tokens for wallet3", async () => {
      await mrc404Token.connect(adminWallet).mint(wallet3, ethers.parseEther("10"), rarityBytes);
    })

    it("Should wallet3 approveForAll for spender1", async () => {
      await expect(mrc404Token.connect(wallet3).setApprovalForAll(spender1.getAddress(), true))
      .to.emit(mrc404Token, "ApprovalForAll").withArgs(wallet3.getAddress(), spender1.getAddress(), true)
      expect(await mrc404Token.isApprovedForAll(wallet3.getAddress(), spender1.getAddress())).to.be.equal(true);
    })

    it("Should spender1 transfers tokenId:11,12 from wallet3 to wallet4", async () => {
      await expect(mrc404Token.connect(spender1).transferFrom(wallet3.getAddress(), wallet4.getAddress(), 11))
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(wallet3.getAddress(), wallet4.getAddress(), 11);
      await expect(mrc404Token.connect(spender1).transferFrom(wallet3.getAddress(), wallet4.getAddress(), 12))
      .to.emit(mrc404Token, "ERC721Transfer").withArgs(wallet3.getAddress(), wallet4.getAddress(), 12);
    })

    it("Should wallet3 get back approveForAll for spender1", async () => {
      await expect(mrc404Token.connect(wallet3).setApprovalForAll(spender1.getAddress(), false))
      .to.emit(mrc404Token, "ApprovalForAll").withArgs(wallet3.getAddress(), spender1.getAddress(), false)
      expect(await mrc404Token.isApprovedForAll(wallet3.getAddress(), spender1.getAddress())).to.be.equal(false);
    })

    it("Should prevent spender1 transfers tokenId:13 from wallet3 with custom error Unauthorized", async () => {
      await expect((
        mrc404Token.connect(spender1).transferFrom(wallet3.getAddress(), wallet4.getAddress(), 13)
      )).to.be.revertedWithCustomError(mrc404Token, "Unauthorized");
    })

  })

  describe("Whitelist", async () => {

    it("Should prevent add to wl because lack of access", async () => {
      await expect((
        mrc404Token.connect(wallet1).setWhitelist(wallet1.getAddress(), true)
      )).to.be.revertedWithCustomError(
        mrc404Token,
        'AccessControlUnauthorizedAccount'
      );
    })
  })

})