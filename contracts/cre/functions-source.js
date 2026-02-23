const walletAddress = args[0];

if (!walletAddress || !walletAddress.startsWith("0x")) {
  throw Error("Invalid wallet address");
}

const API_URL = "https://point-fi.vercel.app/credit-score";

const response = await Functions.makeHttpRequest({
  url: API_URL,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  data: {
    wallet: walletAddress.toLowerCase(),
  },
  timeout: 9000,
});

if (response.error) {
  throw Error(`HTTP error: ${response.error.message}`);
}

if (response.status !== 200) {
  throw Error(`Invalid API status: ${response.status}`);
}

const creditData = response.data;

if (
  typeof creditData.income !== "number" ||
  typeof creditData.employmentMonths !== "number" ||
  typeof creditData.paymentHistory !== "number" ||
  typeof creditData.debtToIncome !== "number"
) {
  throw Error("Malformed credit API response");
}

function computeCreditScore(data) {
  let score = 300;

  // Income (40%)
  if (data.income >= 4000) score += 220;
  else if (data.income >= 3000) score += 180;
  else if (data.income >= 2000) score += 120;
  else if (data.income >= 1500) score += 60;
  else score += 20;

  // Employment (20%)
  if (data.employmentMonths >= 24) score += 110;
  else if (data.employmentMonths >= 12) score += 70;
  else if (data.employmentMonths >= 6) score += 40;
  else if (data.employmentMonths >= 3) score += 20;

  // Payment history (25%)
  const paymentScore = Math.floor(
    (Math.min(data.paymentHistory, 100) / 100) * 137
  );
  score += paymentScore;

  // Debt-to-income (15%)
  const dtiClamped = Math.min(data.debtToIncome, 100);
  const dtiScore = Math.floor(((100 - dtiClamped) / 100) * 83);
  score += dtiScore;

  return Math.min(score, 850);
}

const rawScore = computeCreditScore(creditData);

if (rawScore < 300 || rawScore > 850) {
  throw Error("Score out of bounds");
}

const scaledScore = BigInt(rawScore) * 10n ** 18n;

return Functions.encodeUint256(scaledScore);