export const marketplaceAbi = [
  {
    "type":"function","name":"buySigned","stateMutability":"payable",
    "inputs":[
      {
        "components":[
          {"name":"seller","type":"address"},
          {"name":"nft","type":"address"},
          {"name":"tokenId","type":"uint256"},
          {"name":"currency","type":"address"},
          {"name":"price","type":"uint256"},
          {"name":"expiration","type":"uint256"},
          {"name":"nonce","type":"uint256"}
        ],
        "name":"o","type":"tuple"
      },
      {"name":"signature","type":"bytes"}
    ],
    "outputs":[]
  },
  { "type":"function","name":"cancelNonce","stateMutability":"nonpayable","inputs":[{"name":"nonce","type":"uint256"}],"outputs":[] },
  { "type":"function","name":"protocolFeeBps","stateMutability":"view","inputs":[],"outputs":[{"type":"uint96"}] },
  { "type":"function","name":"feeRecipient","stateMutability":"view","inputs":[],"outputs":[{"type":"address"}] }
] as const;
