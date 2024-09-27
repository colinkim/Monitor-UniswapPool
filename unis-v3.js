import Web3 from 'web3';
import { promises as fs } from 'fs'; // fs 모듈 사용

import UniswapV3PoolABI from './UniswapV3Pool.json' assert { type: 'json' }; // JSON 파일을 ESM 방식으로 가져오기
import NonfungiblePositionManagerABI from './NonfungiblePositionManager.json' assert { type: 'json' }; // JSON 파일을 ESM 방식으로 가져오기

const web3 = new Web3(''); // Infura 또는 Alchemy와 같은 RPC 엔드포인트 사용

// 지갑 주소 및 프라이빗 키
const account = '<YOUR_ACCOUNT_ADDRESS>';
const privateKey = '<YOUR_PRIVATE_KEY>';

// Uniswap V3 관련 설정
const poolAddress = ''; // V3 풀 주소 (특정 토큰 페어에 대한 풀 주소)
const positionManagerAddress = ''; // Nonfungible Position Manager 주소
const tokenA = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270 '; // 풀에 등록된 첫 번째 토큰 주소
const tokenB = '0x40F97Ec376aC1c503E755433BF57f21e3a49f440'; // 풀에 등록된 두 번째 토큰 주소

// 계약 인스턴스 생성
const poolContract = new web3.eth.Contract(UniswapV3PoolABI, poolAddress);
const positionManagerContract = new web3.eth.Contract(NonfungiblePositionManagerABI, positionManagerAddress);

let lastReserve0 = null;
let lastReserve1 = null;
let lastLiquidity = null;

// Swap 이벤트를 감지하는 함수
async function monitorTokenChanges() {
    console.log('Monitoring token0 and token1 changes in Uniswap V3 pool...');
  
    // 최신 블록에서 발생하는 Swap 이벤트 모니터링
    try{
        poolContract.events.Swap({
            fromBlock: 'latest'
          })
          .on('data', (event) => {
            const { sender, amount0, amount1, to } = event.returnValues;
            console.log(`Swap detected:`);
            console.log(`Sender: ${sender}`);
            console.log(`Amount0 (token0 change): ${web3.utils.fromWei(amount0, 'ether')} units`);
            console.log(`Amount1 (token1 change): ${web3.utils.fromWei(amount1, 'ether')} units`);
            console.log(`To: ${to}`);
          })
          .on('error', (error) => {
            console.error('Error while monitoring swaps:', error);
          });
          
        } catch (error) {
            console.error('Failed to setup event monitoring:', error);
        }
    }
    

// 유동성 비율 모니터링 함수
async function monitorLiquidity() {

    // Get the current liquidity and price info
    const { sqrtPriceX96, liquidity } = await getLiquidityAndPrice();

    // If previous liquidity is not set, initialize it
    if (lastLiquidity === null) {
        lastLiquidity = liquidity;
        return;
    }

    // Calculate changes in liquidity
    const liquidityChange = liquidity - lastLiquidity;
    console.log(`Liquidity Change: ${liquidityChange}`);

    // 특정 변화량 조건에 따라 풀을 제거
    // const threshold = 1000; // 예시로 유입/유출 임계값 설정
    // if (Math.abs(liquidityChange) > threshold) {
    //     console.log("유동성 변화를 감지했습니다. 유동성을 제거합니다.");
    //     await removeLiquidity();
    // }

    const threshold = BigInt(1000); // Set threshold as BigInt
    if (liquidityChange < -threshold || liquidityChange > threshold) {
        console.log("유동성 변화를 감지했습니다. 유동성을 제거합니다.");
       // await removeLiquidity();
    }

    // Update last liquidity
    lastLiquidity = liquidity;

    // const { reserve0, reserve1 } = await getReserves();

    // // If previous reserves are not set, initialize them
    // if (lastReserve0 === null || lastReserve1 === null) {
    //     lastReserve0 = reserve0;
    //     lastReserve1 = reserve1;
    //     return;
    // }
    // // Calculate changes in reserves
    // const reserve0Change = reserve0 - lastReserve0;
    // const reserve1Change = reserve1 - lastReserve1;  

    // console.log(`Reserve0 변화량: ${reserve0Change}, Reserve1 변화량: ${reserve1Change}`);


    // // 특정 변화량 조건에 따라 풀을 제거
    // const threshold = 1000; // 예시로 유입/유출 임계값 설정
    // if (Math.abs(reserve0Change) > threshold || Math.abs(reserve1Change) > threshold) {
    //     console.log("토큰 유입/유출 감지됨. 유동성을 제거합니다.");
    //    // await removeLiquidity();
    // }

    // // Update last reserves
    // lastReserve0 = reserve0;
    // lastReserve1 = reserve1;

    // const slot0 = await poolContract.methods.slot0().call(); // 현재 가격 정보와 기타 데이터를 가져옴
    // //const sqrtPriceX96 = slot0[0]; // 현재 가격
    // const sqrtPriceX96 = BigInt(slot0[0]); // 현재 가격을 BigInt로 변환

    // // 유동성 정보를 가져옴
    // const liquidity = await poolContract.methods.liquidity().call();
    // console.log(`Current Liquidity: ${liquidity}`);
    // console.log(`Current Price (sqrtPriceX96): ${sqrtPriceX96}`);

    // // 현재 가격을 계산하기 위한 변환
    // //const price = (sqrtPriceX96 ** 2) / (2 ** 192); // 가격 계산 (Uniswap V3는 sqrtPriceX96 형식으로 가격을 표현)
    // const price = (sqrtPriceX96 ** BigInt(2)) / (BigInt(2) ** BigInt(192)); // 가격 계산 (Uniswap V3는 sqrtPriceX96 형식으로 가격을 표현)

    // console.log(`Current Price (Calculated): ${price}`);

    // const targetPrice = 0.5; // 예시로 목표 가격 설정

    // 가격이 조건에 맞으면 유동성 제거
    // if (price < targetPrice) {
    //     console.log("Target price met, removing liquidity...");

    //     // 유동성 제거 함수 호출
    //     await removeLiquidity();
    // }
}

// 유동성 제거 함수
async function removeLiquidity() {
    const positionId = await getPositionId(); // 사용자의 포지션 ID를 가져옴 (유동성 제공 시 생성된 ID)

    const tx = positionManagerContract.methods.decreaseLiquidity({
        tokenId: positionId,
        liquidity: 100000, // 제거할 유동성의 양
        amount0Min: 1,     // 최소 수령할 토큰 A 양 (슬리피지 방지)
        amount1Min: 1,     // 최소 수령할 토큰 B 양 (슬리피지 방지)
        deadline: Math.floor(Date.now() / 1000) + 60 * 10, // 마감 시간
    });

    const gas = await tx.estimateGas({ from: account });
    const gasPrice = await web3.eth.getGasPrice();
    const data = tx.encodeABI();

    const signedTx = await web3.eth.accounts.signTransaction(
        {
            to: positionManagerAddress,
            data,
            gas,
            gasPrice,
        },
        privateKey
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log('Liquidity removed:', receipt);
}

// 사용자의 포지션 ID를 가져오는 함수
async function getPositionId() {
    const positions = await positionManagerContract.methods.positions(account).call(); // 사용자의 포지션 정보 조회
    return positions[0].tokenId; // 첫 번째 포지션의 tokenId 반환 (포지션이 여러 개일 수 있음)
}

// Reserves를 조회하는 함수
async function getReserves() {
    const reserves = await poolContract.methods.getReserves().call(); // Uniswap V3 풀에서 token0, token1 잔액을 가져옴
    const reserve0 = reserves[0]; // token0의 현재 잔액
    const reserve1 = reserves[1]; // token1의 현재 잔액
    return { reserve0, reserve1 };
}

// 유동성과 가격을 가져오는 함수
async function getLiquidityAndPrice() {
    const slot0 = await poolContract.methods.slot0().call(); // 현재 가격 정보와 기타 데이터를 가져옴
    const sqrtPriceX96 = BigInt(slot0[0]); // 현재 가격을 BigInt로 변환
    const liquidity = await poolContract.methods.liquidity().call(); // 현재 유동성을 가져옴
    console.log(`Liquidity: ${liquidity}, sqrtPriceX96: ${sqrtPriceX96}`);
    return { sqrtPriceX96, liquidity };
}



// 반복적으로 모니터링 실행
setInterval(monitorLiquidity, 15000); // 15초마다 풀 상태를 모니터링

