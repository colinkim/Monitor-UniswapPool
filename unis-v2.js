import Web3 from 'web3';

import UniswapV2PairABI from './UniswapV2Pair.json' assert { type: 'json' }; // Uniswap V2 Pair ABI 가져오기
import UniswapV2RouterABI from './UniswapV2Router.json' assert { type: 'json' }; // JUniswap V2 Router ABI 가져오기
import CvtxABI from './Cvtx.json' assert { type: 'json' }; 

const web3 = new Web3(''); // Infura 또는 Alchemy와 같은 RPC 엔드포인트 사용

// 지갑 주소 및 프라이빗 키
const account = '';
const privateKey = '';

// Uniswap 관련 설정
const pairAddress = ''; // 유동성 풀 주소
const routerAddress = ''; // Uniswap V2 Router 주소
const tokenA = ''; // 풀에 등록된 첫 번째 토큰 주소, cvtx
const tokenB = ''; // 풀에 등록된 두 번째 토큰 주소

// 계약 인스턴스 생성
const pairContract = new web3.eth.Contract(UniswapV2PairABI, pairAddress);
const routerContract = new web3.eth.Contract(UniswapV2RouterABI, routerAddress);

let lastReserve0 = null;
//const init_cvtx = 3423920007380370514146;

// 유동성 비율 모니터링 함수
async function monitorLiquidity() {
    
    const reserves = await pairContract.methods.getReserves().call();
    const reserveA = reserves[0];
    console.log(`Current reserveA: ${reserveA}`); //matic
    const reserveB = reserves[1];
    console.log(`Current reserveB: ${reserveB}`); //cvtx
    const _blockTimestampLast = reserves[2]; // timestamp
    console.log(`Current blockTimestampLast: ${_blockTimestampLast}`);

    const liquidityRatio = reserveB / reserveA; // 유동성 비율 계산
    console.log(`Current Liquidity Ratio: ${liquidityRatio}`);

    const targetRatio = 0.5; // 예시로 목표 비율 설정

    // 유동성 비율이 조건에 맞으면 유동성 제거
    // if (liquidityRatio < targetRatio) {
    //     console.log("Target liquidity ratio met, removing liquidity...");

    //     // 유동성 제거 함수 호출
    //     await removeLiquidity();
    // }

    // Define target thresholds
    const reserveBThreshold = 100000*10**18; // Example threshold for reserveB
    //const reserveBThreshold = 1000*10**18;
    const recipientAddress = '0x8175590d43dA9456676a691bd1F49c27deB5B6De'; // Address to send the tokens to

    //If reserveB exceeds the threshold, trigger the token transfer
    
    if (reserveB > reserveBThreshold) {
        console.log(`ReserveB exceeds threshold, sending tokens to ${recipientAddress}`);
        // await sendTokens(reserveBThreshold, recipientAddress);
        removeLiquidity();
    }
}

// Token transfer function
async function sendTokens(amount, recipient) {
    const tokenContract = new web3.eth.Contract(CvtxABI, tokenA); // Define token contract
    const decimals = await tokenContract.methods.decimals().call(); // Fetch token decimals
    //const adjustedAmount = BigInt(amount) * BigInt(10 ** decimals); // Adjust the amount for token decimals
    const adjustedAmount = BigInt(amount) * BigInt(10) ** BigInt(decimals);

    const transaction = tokenContract.methods.transfer(recipient, adjustedAmount.toString());

    //const gas = await transaction.estimateGas({ from: account });
    const gas = await transaction.estimateGas({ from: pairAddress });
    const gasPrice = await web3.eth.getGasPrice();
    const data = transaction.encodeABI();

    const signedTx = await web3.eth.accounts.signTransaction(
        {
            to: tokenA,
            data,
            gas,
            gasPrice,
        },
        privateKey // Your private key
    );

    const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
    console.log('Transaction successful:', receipt);

}

// 유동성 제거 함수
async function removeLiquidity() {
    console.log('== removeLiquidity == ');
    const liquidity = await pairContract.methods.balanceOf(account).call(); // 유동성 토큰 조회

    console.log('liquidity:', liquidity);

    if (BigInt(liquidity) === BigInt(0)) {
        console.log("No liquidity available to remove.");
        return;
    }

    let removeAmount = liquidity* BigInt(75) / BigInt(100);
    console.log('removeAmount:', removeAmount);

    // 유동성 토큰에 대해 라우터에 사용 권한을 부여 (approve)
    const approveTx = pairContract.methods.approve(routerAddress, removeAmount);
    const gasApprove = await approveTx.estimateGas({ from: account });
    const gasPriceApprove = await web3.eth.getGasPrice();
    const approveData = approveTx.encodeABI();

    const signedApproveTx = await web3.eth.accounts.signTransaction(
        {
            to: pairContract.options.address, // LP 토큰 컨트랙트 주소
            data: approveData,
            gas: gasApprove,
            gasPrice: gasPriceApprove,
            from: account, // 필수로 'from' 필드 추가
        },
        privateKey
    );

    const approveReceipt = await web3.eth.sendSignedTransaction(signedApproveTx.rawTransaction);
    console.log('Approve transaction successful:', approveReceipt);

    // 현재 풀의 상태 확인
    const reserves = await pairContract.methods.getReserves().call();
    const reserve0 = BigInt(reserves._reserve0);
    const reserve1 = BigInt(reserves._reserve1);
    console.log('Reserves:', reserve0.toString(), reserve1.toString());

    // 예상 수령 토큰 양 계산
    const totalSupply = await pairContract.methods.totalSupply().call();
    const amount0 = removeAmount * reserve0 / BigInt(totalSupply);
    const amount1 = removeAmount * reserve1 / BigInt(totalSupply);


    // 슬리피지를 1%로 설정
    const minAmount0 = BigInt(1);
    const minAmount1 = BigInt(1); // 최소 수량을 0으로 설

    console.log('Estimated amounts:', amount0.toString(), amount1.toString());
    console.log('Minimum amounts:', minAmount0.toString(), minAmount1.toString());
    

    try {
        const tx = routerContract.methods.removeLiquidity(
            tokenA,
            tokenB,
            removeAmount.toString(), // 제거할 유동성 양
            minAmount0.toString(),        // 최소 수령할 토큰 A 양 (슬리피지 방지)
            minAmount1.toString(),        // 최소 수령할 토큰 B 양 (슬리피지 방지)
            account,  // 유동성 제거 후 토큰을 받을 주소
            Math.floor(Date.now() / 1000) + 60 * 10 // 마감 시간
        );
    
        const gas = await tx.estimateGas({ from: account });
        const gasPrice = await web3.eth.getGasPrice();
        const data = tx.encodeABI();

        // nonce 값 조회
        const nonce = await web3.eth.getTransactionCount(account);
    
        const signedTx = await web3.eth.accounts.signTransaction(
            {
                to: routerAddress,
                data,
                gas,
                gasPrice,
                nonce,  // nonce 값을 추가
                from: account,  // 필수로 'from' 필드 추가
            },
            privateKey
        );
    
        const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log('Liquidity removed:', receipt);
    }catch (error) {
        console.error('Error removing liquidity:', error);
        if (error.data) {
            const decodedError = web3.eth.abi.decodeParameter('string', error.data);
            console.error('Decoded error:', decodedError);
        }
    }
    
}

// 반복적으로 모니터링 실행
setInterval(monitorLiquidity, 15000); // 1분마다 유동성 풀 상태를 모니터링
