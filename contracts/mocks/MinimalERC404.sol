//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ERC404} from "../erc404/ERC404.sol";

contract MinimalERC404 is Ownable, ERC404 {
  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_,
    uint256 maxTotalSupplyERC721_,
    address initialOwner_
  )
    ERC404(name_, symbol_, decimals_, maxTotalSupplyERC721_)
    Ownable(initialOwner_)
  {
    
  }

  function mintERC20(address account_, uint256 value_, bool mintCorrespondingERC721s_) external onlyOwner {
    _mintERC20(account_, value_, mintCorrespondingERC721s_);
  }

  function tokenURI(uint256 id) public pure override returns (string memory) {
    return string.concat("https://example.com/token/", Strings.toString(id));
  }

  function setWhitelist(address account, bool value) external onlyOwner {
    _setWhitelist(account, value);
  }
}
