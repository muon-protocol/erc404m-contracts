//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {MRC404} from "../extensions/MRC404.sol";

contract ExampleMRC404 is MRC404 {
  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 maxTotalSupplyERC721_,
    address initialAdmin_,
    address initialMintRecipient_
  ) MRC404(name_, symbol_, decimals_, initialAdmin_) {
    // Do not mint the ERC721s to the initial owner, as it's a waste of gas.
    _setWhitelist(initialMintRecipient_, true);
    _mintERC20(initialMintRecipient_, maxTotalSupplyERC721_ * units, false);
  }

  function tokenURI(uint256 id_) public pure override returns (string memory) {
    return string.concat("https://example.com/token/", Strings.toString(id_));
  }

  function encodeData(uint256 id) public view override returns (bytes memory) {}

  function burnFrom(
    address from,
    uint256 amount
  ) public override returns (bytes memory nftData) {}

  function burnFrom(
    address from,
    uint256[] calldata nftIds
  ) public override returns (bytes memory nftData) {}

  function mint(
    address to,
    uint256 amount,
    bytes calldata data
  ) public override returns (uint256[] memory nftIds) {
    nftIds = _mint(to, amount);
  }
}
