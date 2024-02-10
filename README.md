# NOTICE (EXPERIMENTAL – NOT PRODUCTION READY)

> 🚨🚨 This repo is an early iteration a more robust ERC404 implementation. **It is not intended to be used in production.**
> Please refer to [this repository](https://github.com/Pandora-Labs-Org/erc404-legacy) for the version of ERC404 that was released with Pandora. 🚨🚨

# ERC404

ERC404 is an experimental, mixed ERC20 / ERC721 implementation with native liquidity and fractionalization. While these two standards are not designed to be mixed, this implementation strives to do so in as robust a manner as possible while minimizing tradeoffs.

In it's current implementation, ERC404 effectively isolates ERC20 / ERC721 standard logic or introduces pathing where possible. Pathing could best be described as a lossy encoding scheme in which token amount data and ids occupy shared space under the assumption that negligible token transfers occupying id space do not or do not need to occur. Integrating protocols should ideally confirm these paths by checking that submitted parameters are below the token id range or above.

This standard is entirely experimental and unaudited, while testing has been conducted in an effort to ensure execution is as accurate as possible. The nature of overlapping standards, however, does imply that integrating protocols will not fully understand their mixed function.

This iteration of ERC404 specifically aims to address common use-cases and define better interfaces for standardization, that reduce or remove conflicts with existing ERC20 / ERC721 consensus.

## Usage

To deploy your own ERC404 token, look at the example provided in the src folder, ExampleERC404.sol.

### Examples

This is an extremely simple minimal version of an ERC404 that mints the entire supply to the initial owner of the contract.

Generally the initial tokens minted to the deployer will be added to a DEX as liquidity. The DEX pool address should also be added to the whitelist to prevent minting NFTs to it and burning NFTs from it on transfer.

## Uniswap V3

Use the below as guidelines on how to prepare for and deploy to a Uniswap V3 pool:

To predict the address of your Uniswap V3 Pool, use the following simulator: [https://dashboard.tenderly.co/shared/simulation/92dadba3-92c3-46a2-9ccc-c793cac6c33d](https://dashboard.tenderly.co/shared/simulation/92dadba3-92c3-46a2-9ccc-c793cac6c33d).

To use:

1. Click Re-Simulate in the top right corner.
2. Update the simulation parameters: `tokenA` (your token address), `tokenB` (typically WETH, or `0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2`), and set the fee tier to either 500, 3000 (for 0.3%), or 10000 (for 1%).
3. Run Simulate, and then expand the Input/Output section. The output on the right column will show the derived pool address.

## Licensing

Copyright 2024 Pandora Labs LLC

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
