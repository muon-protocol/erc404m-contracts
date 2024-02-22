import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect, } from "chai";
import { ethers } from "hardhat";
import { ERC404m } from "../typechain-types";
import { Signer } from "ethers";


describe("ERC404m", async () => {
  const rarityBytes = "0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000";
  let adminWallet: Signer;
  let wallet1: Signer;
  let mrc404Token: ERC404m;


  const deployMRC404 = async () => {
    const token = await ethers.deployContract("ERC404m", [""]);
    return token;
  }

  before(async () => {
    [
      adminWallet,
      wallet1,
    ] = await ethers.getSigners();
    mrc404Token = await loadFixture(deployMRC404);
  })

  describe("Admin funcs", async () => {

    it("Should prevent mint because lack of access", async () => {
      await expect((
        mrc404Token.connect(wallet1).mint(wallet1.getAddress(), 2, rarityBytes)
      )).to.be.revertedWithCustomError(
        mrc404Token,
        'AccessControlUnauthorizedAccount'
      );
    })

    it("Should adminWallet mint 2 for wallet1", async () => {
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

    it("Should adminWallet mint .9 for wallet1", async () => {
      await expect(mrc404Token.connect(adminWallet).mint(wallet1.getAddress(), ethers.parseEther(".9"), rarityBytes))
      .to.emit(mrc404Token, "ERC20Transfer").withArgs(ethers.ZeroAddress, wallet1.getAddress(), ethers.parseEther(".9"))
      expect(await mrc404Token.erc20BalanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("2.9"));
      expect(await mrc404Token.erc721BalanceOf(wallet1.getAddress())).to.be.equal(2);
      expect(await mrc404Token.balanceOf(wallet1.getAddress())).to.be.equal(ethers.parseEther("2.9"));
    })

  })



})