//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {MRC404} from "../extensions/MRC404.sol";

contract ERC404m is MRC404 {
  mapping(uint256 => uint8) public rarityValues;
  string public baseTokenURI;

  constructor(
    string memory _baseTokenURI
  ) MRC404("Muon ERC404", "ERC404m", 18, msg.sender) {
    baseTokenURI = _baseTokenURI;
    setSelfERC721TransferExempt(true);
    _grantRole(MINTER_ROLE, msg.sender);
  }

  function setBaseTokenURI(
    string memory _tokenURI
  ) external onlyRole(DAO_ROLE) {
    baseTokenURI = _tokenURI;
  }

  function setNameSymbol(
    string memory _name,
    string memory _symbol
  ) external onlyRole(DAO_ROLE) {
    name = _name;
    symbol = _symbol;
  }

  function getRarity(uint256 _id) public view returns (uint8) {
    if (rarityValues[_id] != 0) {
      return rarityValues[_id];
    }

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

    // return
    //   string(
    //     abi.encodePacked(
    //       baseTokenURI,
    //       Strings.toString(rarity),
    //       "/",
    //       Strings.toString(block.chainid),
    //       "/",
    //       Strings.toString(_id)
    //     )
    //   );

    return
      string(
        abi.encodePacked(
          baseTokenURI,
          Strings.toString(rarity),
          "/",
          Strings.toString(_id)
        )
      );
  }

  function burnFrom(
    address from,
    uint256 amount
  ) public override returns (bytes memory nftData) {
    uint256[] memory nftIds = _burnFromERC20(from, amount);
    nftData = encodeData(nftIds);
    uint256 nftIdsLength = nftIds.length;
    for (uint256 i = 0; i < nftIdsLength; i++) {
      delete rarityValues[nftIds[i]];
    }
  }

  function burnFrom(
    address from,
    uint256[] calldata nftIds
  ) public override returns (bytes memory nftData) {
    _burnFromERC721(from, nftIds);
    nftData = encodeData(nftIds);
    uint256 nftIdsLength = nftIds.length;
    for (uint256 i = 0; i < nftIdsLength; i++) {
      delete rarityValues[nftIds[i]];
    }
  }

  function mint(
    address to,
    uint256 amount,
    bytes calldata data
  ) public override returns (uint256[] memory) {
    uint256[] memory nftIds = _mint(to, amount);
    uint8[] memory rarities = decodeData(data);
    uint256 nftIdsLength = nftIds.length;
    uint256 raritiesLength = rarities.length;
    for (uint256 i = 0; i < nftIdsLength; i++) {
      if (i < raritiesLength && rarities[i] != 0) {
        rarityValues[nftIds[i]] = rarities[i];
      } else {
        rarityValues[nftIds[i]] = getRarity(nftIds[i]);
      }
    }
    return nftIds;
  }

  function encodeData(uint256 id) public view override returns (bytes memory) {
    return abi.encode(getRarity(id));
  }

  function decodeData(
    bytes calldata data
  ) public pure returns (uint8[] memory rarities) {
    bytes[] memory bytesArray = abi.decode(data, (bytes[]));
    uint256 length = bytesArray.length;

    rarities = new uint8[](length);
    for (uint256 i = 0; i < length; i++) {
      rarities[i] = abi.decode(bytesArray[i], (uint8));
    }
  }
}
