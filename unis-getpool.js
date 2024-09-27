import Web3 from 'web3';
const web3 = new Web3('https://polygon-mainnet.infura.io/v3/e90a6ea76c6c4f9ba297420dd915fb0d');

// Uniswap V2 Factory 주소
const factoryAddress = '0x9e5A52f57b3038F1B8EeE45F28b3C1967e22799C';

// Factory ABI
import factoryABI from './UniswapV2Factory.json' assert { type: 'json' }; // JSON 파일을 ESM 방식으로 가져오기

const factoryContract = new web3.eth.Contract(factoryABI, factoryAddress);

// Token A와 Token B 주소
const tokenA = '0x40F97Ec376aC1c503E755433BF57f21e3a49f440'; // TokenA 주소
const tokenB = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'; // TokenB 주소

factoryContract.methods.getPair(tokenA, tokenB).call()
  .then(pairAddress => {
    console.log("Pool Address:", pairAddress);
  })
  .catch(err => {
    console.error(err);
  });

