// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721, ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC2981, ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";

contract TestNFT is ERC721URIStorage, ERC2981, Ownable {
    uint256 public nextId;

    constructor(address _owner, address royaltyReceiver, uint96 royaltyBps)
        ERC721("Demo NFT", "DNFT")
        Ownable(_owner)
    {
        if (royaltyReceiver != address(0) && royaltyBps > 0) {
            _setDefaultRoyalty(royaltyReceiver, royaltyBps);
        }
    }

    function mint(string memory tokenUri) external returns (uint256 tokenId) {
        tokenId = nextId++;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenUri);
    }

    // v5: must override ERC721URIStorage + ERC2981
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
