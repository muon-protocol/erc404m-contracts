//SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

interface IERC404 {
  event ERC20Transfer(address indexed from, address indexed to, uint256 amount);
  event ERC721Transfer(
    address indexed from,
    address indexed to,
    uint256 indexed id
  );
  event Approval(
    address indexed owner,
    address indexed spender,
    uint256 amount
  );
  event Transfer(address indexed from, address indexed to, uint256 indexed id);
  event ERC721Approval(
    address indexed owner,
    address indexed spender,
    uint256 indexed id
  );
  event ApprovalForAll(
    address indexed owner,
    address indexed operator,
    bool approved
  );

  error NotFound();
  error AlreadyExists();
  error InvalidRecipient();
  error InvalidSender();
  error UnsafeRecipient();
  error Unauthorized();

  function setWhitelist(address target, bool state) external;
  function ownerOf(uint256 id) external view returns (address owner);
  function tokenURI(uint256 id) external view returns (string memory);
  function approve(address spender, uint256 amountOrId) external returns (bool);
  function setApprovalForAll(address operator, bool approved) external;
  function transferFrom(address from, address to, uint256 amountOrId) external;
  function transfer(address to, uint256 amount) external returns (bool);
  function safeTransferFrom(address from, address to, uint256 id) external;
  function safeTransferFrom(
    address from,
    address to,
    uint256 id,
    bytes calldata data
  ) external;
}
