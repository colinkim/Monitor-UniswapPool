// 예시 Unix 타임스탬프 (Polygon 블록 타임스탬프는 초 단위로 제공됨)
const unixTimestamp = 1726196336; // 예시로 블록 타임스탬프 사용

// Unix 타임스탬프를 밀리초로 변환 (JavaScript의 Date는 밀리초 단위를 사용)
const date = new Date(unixTimestamp * 1000);

// 변환된 날짜와 시간 출력
console.log("UTC Time: " + date.toUTCString());
console.log("Local Time: " + date.toLocaleString());

