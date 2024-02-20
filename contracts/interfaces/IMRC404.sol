//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IERC404.sol";

interface IMRC404 is IERC404 {
  function burnFrom(
    address from,
    uint256 amount
  ) external returns (bytes memory nftData);

  function mint(
    address to,
    uint256 amount,
    bytes calldata data
  ) external returns (uint256[] memory nftIds);

  function encodeData(uint256 id) external view returns (bytes memory);

  function encodeData(
    uint256[] calldata ids
  ) external view returns (bytes memory);
}
