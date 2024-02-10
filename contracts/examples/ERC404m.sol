//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {MRC404} from "../extensions/MRC404.sol";

contract ERC404m is MRC404 {

  string public baseTokenURI;

  constructor(
      address _initialAdmin_,
      address _initialMintRecipient,
      string memory _baseTokenURI
  ) MRC404("Multichain ERC404 by muon", "ERC404m", 18, _initialAdmin_) {
      baseTokenURI = _baseTokenURI;
      _setWhitelist(_initialMintRecipient, true);
  }

  function setBaseTokenURI(string memory _tokenURI) external onlyRole(DAO_ROLE) {
      baseTokenURI = _tokenURI;
  }

  function setNameSymbol(
      string memory _name,
      string memory _symbol
  ) external onlyRole(DAO_ROLE) {
      name = _name;
      symbol = _symbol;
  }

  function getRarity(uint256 _id) public pure returns (uint8) {
      uint8 seed = uint8(bytes1(keccak256(abi.encodePacked(_id))));

      if (seed <= 100) {
          return 1;
      } else if (seed <= 160) {
          return 2;
      } else if (seed <= 210) {
          return 3;
      } else if (seed <= 240) {
          return 4;
      } else if (seed <= 255) {
          return 5;
      }

      return 0;
  }

  function tokenURI(uint256 _id) public view override returns (string memory) {

      uint8 rarity = getRarity(_id);

      return string.concat(
          baseTokenURI,
          string.concat(
              Strings.toString(rarity),
              string.concat(
                "/",
                Strings.toString(_id)
              )
          )
      );
  }
}
