// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library ERC20Events {
  event ERC20Approval(
    address indexed owner,
    address indexed spender,
    uint256 value
  );
  event ERC20Transfer(address indexed from, address indexed to, uint256 amount);
}
